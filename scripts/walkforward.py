#!/usr/bin/env python3
"""
복합 룰셋 워크포워드 백테스트 보고서.

전략: "과거 반응 양성 티커 AND T+1 갭업 < 2%" 조건 충족 시 진입 C (T+1 장종)
비교군: 조건 없이 전 표본 진입 (Baseline)

Walk-forward:
  - article_idx 순 정렬 → 앞 50% 데이터로 티커별 과거 반응 캘리브레이션
  - 뒤 50%에서 복합 룰 적용 후 성과 측정

보유 기간: 1·5·10거래일 (C 진입 기준)

출력: data/publish_horizon_walkforward.json + 터미널 보고서
"""

from __future__ import annotations

import json
import random
import sys
from dataclasses import dataclass
from datetime import date as date_type, datetime, timezone, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
OUT_JSON = BASE / "data" / "publish_horizon_walkforward.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import entry_hold_analysis as eh
from excluded_tickers import is_excluded
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)

KST = timezone(timedelta(hours=9))
HOLD_DAYS = [1, 5, 10]
GAP_THRESHOLD = 0.02      # T+1 갭업 임계값 (2%)


# ─────────────────────────────────────────────
# 이벤트 수집 (news_signal_factors 와 동일 구조)
# ─────────────────────────────────────────────

@dataclass
class Event:
    ticker: str
    article_idx: int
    published_at: str
    r_c: dict[int, float]   # hold_days → return
    gap_up: float | None    # T+1 갭업 비율


def collect_events() -> list[Event]:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        raise RuntimeError("manifest 없음")
    articles_path = default_articles_path(BASE)
    if not articles_path.is_file():
        raise RuntimeError("기사 파일 없음")

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}
    events: list[Event] = []

    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True
    ):
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        t0_str = ev["t0"]
        rel = m.get("intraday_path")
        eod_rel = m.get("eod_path")
        if not ticker or not t0_str or not rel or not eod_rel:
            continue
        if not eh.valid_ticker(ticker) or is_excluded(ticker):
            continue
        if not (EODHD_WINDOWS / eod_rel).is_file() or not (EODHD_WINDOWS / rel).is_file():
            continue

        bars = eh._cached_eod_bars(eod_rel)
        t0_d = date_type.fromisoformat(t0_str)
        i0 = eh.eod_index_on_or_after(bars, t0_d)
        if i0 is None or i0 + 1 >= len(bars):
            continue

        all_intra = eh._cached_intra_bars(rel)
        t0_date = str(bars[i0]["date"])
        t1_date = str(bars[i0 + 1]["date"])

        px_c = eh.last_intraday_session_close(all_intra, t1_date)
        if px_c is None or px_c <= 0:
            continue

        r_c: dict[int, float] = {}
        for h in HOLD_DAYS:
            si = i0 + 1 + h
            if si >= len(bars):
                continue
            sd = str(bars[si]["date"])
            sp = eh.last_intraday_session_close(all_intra, sd)
            if sp is not None:
                r_c[h] = (sp - px_c) / px_c

        if not r_c:
            continue

        # 갭업
        t0_close = eh.last_intraday_session_close(all_intra, t0_date)
        t1_open  = eh.first_intraday_session_open(all_intra, t1_date)
        gap: float | None = None
        if t0_close and t1_open and t0_close > 0:
            gap = (t1_open - t0_close) / t0_close

        events.append(Event(
            ticker=ticker,
            article_idx=ev["article_idx"],
            published_at=ev["published_at"],
            r_c=r_c,
            gap_up=gap,
        ))

    return sorted(events, key=lambda e: e.article_idx)


# ─────────────────────────────────────────────
# 통계 유틸
# ─────────────────────────────────────────────

def stats(xs: list[float]) -> dict:
    if not xs:
        return {
            "n": 0, "mean_pct": None, "median_pct": None,
            "win_rate": None, "n_pos": 0, "n_neg": 0,
            "avg_pos_pct": None, "avg_neg_pct": None,
            "profit_factor": None,
        }
    n = len(xs)
    pos = [x for x in xs if x > 0]
    neg = [x for x in xs if x < 0]
    s = sorted(xs)
    med = (s[n // 2] + s[(n - 1) // 2]) / 2
    avg_pos = sum(pos) / len(pos) if pos else 0.0
    avg_neg = sum(neg) / len(neg) if neg else 0.0
    pf = abs(avg_pos / avg_neg) if avg_neg != 0 else None
    return {
        "n": n,
        "mean_pct": round(sum(xs) / n * 100, 4),
        "median_pct": round(med * 100, 4),
        "win_rate": round(len(pos) / n, 4),
        "n_pos": len(pos),
        "n_neg": len(neg),
        "avg_pos_pct": round(avg_pos * 100, 4),
        "avg_neg_pct": round(avg_neg * 100, 4),
        "profit_factor": round(pf, 3) if pf is not None else None,
    }


def bootstrap_diff(a: list[float], b: list[float], *, n_boot: int = 3000, seed: int = 42) -> dict:
    rng = random.Random(seed)
    if not a or not b:
        return {"point_pct": None, "ci95": [None, None], "likely_real": False}
    pt = (sum(a) / len(a) - sum(b) / len(b)) * 100
    diffs = []
    for _ in range(n_boot):
        sa = [rng.choice(a) for _ in a]
        sb = [rng.choice(b) for _ in b]
        diffs.append((sum(sa) / len(sa) - sum(sb) / len(sb)) * 100)
    diffs.sort()
    lo = diffs[int(0.025 * n_boot)]
    hi = diffs[int(0.975 * n_boot)]
    return {
        "point_pct": round(pt, 4),
        "ci95": [round(lo, 4), round(hi, 4)],
        "likely_real": lo > 0 or hi < 0,
    }


# ─────────────────────────────────────────────
# 워크포워드 핵심 로직
# ─────────────────────────────────────────────

def run_walkforward(events: list[Event]) -> dict:
    n_total = len(events)
    cut = n_total // 2   # 앞 50% = 캘리브레이션, 뒤 50% = 테스트

    calib = events[:cut]
    test  = events[cut:]

    # 캘리브레이션: 티커별 과거 반응 평균 (1일 기준)
    ticker_past: dict[str, list[float]] = {}
    for e in calib:
        r = e.r_c.get(1)
        if r is not None:
            ticker_past.setdefault(e.ticker, []).append(r)

    # 티커 분류
    positive_tickers = {t for t, rs in ticker_past.items() if rs and sum(rs) / len(rs) > 0}
    negative_tickers = {t for t, rs in ticker_past.items() if rs and sum(rs) / len(rs) <= 0}
    new_tickers = set()

    results: dict[int, dict[str, list[float]]] = {h: {"all": [], "rule": [], "no_rule": []} for h in HOLD_DAYS}

    for e in test:
        seen = e.ticker in ticker_past

        # 전략 조건: 과거 양성 + 갭업 < GAP_THRESHOLD
        is_past_positive = e.ticker in positive_tickers
        gap_ok = (e.gap_up is None) or (e.gap_up < GAP_THRESHOLD)
        rule_pass = is_past_positive and gap_ok

        if not seen:
            new_tickers.add(e.ticker)

        for h in HOLD_DAYS:
            r = e.r_c.get(h)
            if r is None:
                continue
            results[h]["all"].append(r)
            if rule_pass:
                results[h]["rule"].append(r)
            else:
                results[h]["no_rule"].append(r)

    return {
        "calib_n": cut,
        "test_n": n_total - cut,
        "calib_positive_tickers": len(positive_tickers),
        "calib_negative_tickers": len(negative_tickers),
        "test_new_tickers": len(new_tickers),
        "results": results,
    }


# ─────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────

def run() -> None:
    print("이벤트 수집 중...")
    events = collect_events()
    print(f"  수집 완료: {len(events):,}건")

    wf = run_walkforward(events)
    results = wf["results"]

    out: dict = {
        "generated_at": datetime.now().isoformat(),
        "strategy": "진입 C × 복합 룰 (과거 양성 티커 AND 갭업 <2%)",
        "methodology": {
            "walk_forward_split": "50:50 (article_idx 순)",
            "calibration_period_n": wf["calib_n"],
            "test_period_n": wf["test_n"],
            "calib_positive_tickers": wf["calib_positive_tickers"],
            "calib_negative_tickers": wf["calib_negative_tickers"],
            "test_new_tickers_skipped": wf["test_new_tickers"],
            "gap_threshold": f"{GAP_THRESHOLD:.0%}",
            "note": "캘리브레이션 구간에서 과거 반응 집계 → 테스트 구간에만 룰 적용. 룩어헤드 없음.",
        },
        "hold_periods": {},
    }

    for h in HOLD_DAYS:
        r_all  = results[h]["all"]
        r_rule = results[h]["rule"]
        r_no   = results[h]["no_rule"]
        diff   = bootstrap_diff(r_rule, r_no)
        vs_all = bootstrap_diff(r_rule, r_all)

        out["hold_periods"][f"{h}d"] = {
            "hold_days": h,
            "baseline_all":  stats(r_all),
            "strategy_rule": stats(r_rule),
            "rejected":      stats(r_no),
            "diff_rule_vs_rejected": diff,
            "diff_rule_vs_all": vs_all,
        }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"저장: {OUT_JSON}\n")

    # ── 터미널 보고서 ──────────────────────────────────────
    BOLD  = "\033[1m"
    GREEN = "\033[92m"
    RED   = "\033[91m"
    CYAN  = "\033[96m"
    RESET = "\033[0m"
    DIM   = "\033[2m"

    print(f"{BOLD}{'='*65}{RESET}")
    print(f"{BOLD}  복합 룰셋 워크포워드 백테스트 보고서{RESET}")
    print(f"  전략: {CYAN}과거 반응 양성 티커 AND T+1 갭업 < 2%{RESET}  →  진입 C")
    print(f"{BOLD}{'='*65}{RESET}")
    print(f"  캘리브레이션({wf['calib_n']}건) → 과거 양성 티커 {wf['calib_positive_tickers']}개 학습")
    print(f"  테스트({wf['test_n']}건) 중 신규 티커(이력 없어 룰 미적용) {wf['test_new_tickers']}개")
    print()

    for h in HOLD_DAYS:
        d = out["hold_periods"][f"{h}d"]
        b  = d["baseline_all"]
        st = d["strategy_rule"]
        rej = d["rejected"]
        diff = d["diff_rule_vs_rejected"]
        vs_all = d["diff_rule_vs_all"]

        def fmt(s: dict) -> str:
            if s["n"] == 0:
                return "n=0"
            wr = (s["win_rate"] or 0) * 100
            col = GREEN if (s["mean_pct"] or 0) > 0 else RED
            return (f"n={s['n']}, 평균 {col}{s['mean_pct']:+.3f}%{RESET}, "
                    f"승률 {wr:.1f}%, "
                    f"PF {s['profit_factor'] or '-'}")

        pt   = diff["point_pct"]
        ci   = diff["ci95"]
        real = diff["likely_real"]
        verdict = f"{GREEN}유의 ✓{RESET}" if real else f"{DIM}불확실{RESET}"
        pt2  = vs_all["point_pct"]
        ci2  = vs_all["ci95"]
        real2 = vs_all["likely_real"]
        verdict2 = f"{GREEN}유의 ✓{RESET}" if real2 else f"{DIM}불확실{RESET}"

        print(f"{BOLD}▶ 보유 {h}거래일{RESET}")
        print(f"  {DIM}[전체 베이스라인]{RESET} {fmt(b)}")
        print(f"  {GREEN}[복합 룰 통과 → 진입]{RESET}  {fmt(st)}")
        print(f"  {RED}[룰 미통과 (제외됨)]{RESET}  {fmt(rej)}")
        print(f"  {BOLD}통과 vs 제외 평균차:{RESET} {'+' if pt and pt>0 else ''}{pt:.3f}%p  "
              f"95%CI [{ci[0]}, {ci[1]}]  {verdict}")
        print(f"  {BOLD}통과 vs 전체    차:{RESET} {'+' if pt2 and pt2>0 else ''}{pt2:.3f}%p  "
              f"95%CI [{ci2[0]}, {ci2[1]}]  {verdict2}")
        print()

    print(f"{DIM}주의: 같은 데이터로 지표를 선택했으므로 in-sample 편향 일부 포함.")
    print(f"      walk-forward로 50:50 분리했지만 시기별 시장 편향이 있을 수 있음.{RESET}")


if __name__ == "__main__":
    run()
