#!/usr/bin/env python3
"""
뉴스 이벤트 4가지 신호 지표 검증 (실데이터 A/B).

결과 변수: 진입 C (T+1 장종 5분봉 종가), 보유 1·5거래일 수익률.

지표 4종:
① 발행 시간대: 장전(~08:59 KST), 장중(09:00~15:29), 장후(15:30~)
② T+1 갭업 크기: (T+1 첫 봉 시가 - T0 마지막 봉 종가) / T0 마지막 봉 종가
③ T0 당일 윗꼬리 비율: (고가 - 종가) / (고가 - 저가), 5분봉 합산 기준
④ 종목 과거 반응 일관성: 해당 티커가 과거 다른 기사에서 C·1일 평균이 양수였는지

출력: 집단별 평균·승률·n + 부트스트랩 95% CI (seed 고정).
"""

from __future__ import annotations

import json
import random
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
OUT_JSON = BASE / "data" / "news_signal_factors.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import entry_hold_analysis as eh  # noqa: E402
from excluded_tickers import is_excluded  # noqa: E402
from news_article_events import (  # noqa: E402
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
    article_row_kst_calendar_date,
)
from datetime import date as date_type

KST = timezone(timedelta(hours=9))

HOLD_DAYS_CHECK = [1, 5]   # C 진입 후 보유 거래일


# ─────────────────────────────────────────────
# 보조 함수
# ─────────────────────────────────────────────

def kst_hour(published_at: str) -> int | None:
    """published_at ISO → KST 시각(시)."""
    s = published_at.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(KST).hour


def time_band(hour: int | None) -> str:
    """장전 / 장중 / 장후."""
    if hour is None:
        return "unknown"
    if hour < 9:
        return "pre"       # 장전 (~08:59)
    if hour < 15 or (hour == 15 and True):   # 15:30 기준
        return "intraday"  # 장중 (09:00~15:29)
    return "post"          # 장후 (15:30~)


def t0_session_high_low_close(all_intra: list, ymd: str) -> tuple[float, float, float] | None:
    day = eh._day_session_bars(all_intra, ymd)
    if not day:
        return None
    highs = [float(b.get("high") or b.get("close") or 0) for b in day]
    lows  = [float(b.get("low")  or b.get("close") or 0) for b in day]
    day_sorted = sorted(day, key=lambda x: x["datetime"])
    last_close = float(day_sorted[-1].get("close") or day_sorted[-1].get("open") or 0)
    h = max(highs)
    l = min(lows)
    if h <= 0 or l <= 0 or last_close <= 0:
        return None
    return h, l, last_close


def upper_shadow_ratio(h: float, l: float, c: float) -> float | None:
    """(고가 - 종가) / (고가 - 저가). 0이면 완전 양봉."""
    rng = h - l
    if rng <= 0:
        return None
    return (h - c) / rng


def t1_gap(all_intra: list, t0_date: str, t1_date: str) -> float | None:
    """(T+1 첫 봉 시가 - T0 마지막 봉 종가) / T0 마지막 봉 종가."""
    t0_close = eh.last_intraday_session_close(all_intra, t0_date)
    t1_open  = eh.first_intraday_session_open(all_intra, t1_date)
    if t0_close is None or t1_open is None or t0_close <= 0:
        return None
    return (t1_open - t0_close) / t0_close


# ─────────────────────────────────────────────
# 이벤트 루프
# ─────────────────────────────────────────────

@dataclass
class Event:
    ticker: str
    article_idx: int
    published_at: str
    r_c: dict[int, float]   # hold_days → return
    time_band: str
    gap_up: float | None
    upper_shadow: float | None


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
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        t0_str = ev["t0"]
        published_at = ev["published_at"]
        rel   = m.get("intraday_path")
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
        for h in HOLD_DAYS_CHECK:
            si = i0 + 1 + h
            if si >= len(bars):
                continue
            sd = str(bars[si]["date"])
            sp = eh.last_intraday_session_close(all_intra, sd)
            if sp is not None:
                r_c[h] = (sp - px_c) / px_c

        if not r_c:
            continue

        # 지표 계산
        hour = kst_hour(published_at)
        band = time_band(hour)

        gap = t1_gap(all_intra, t0_date, t1_date)

        hlc = t0_session_high_low_close(all_intra, t0_date)
        shadow = upper_shadow_ratio(*hlc) if hlc else None

        events.append(Event(
            ticker=ticker,
            article_idx=ev["article_idx"],
            published_at=published_at,
            r_c=r_c,
            time_band=band,
            gap_up=gap,
            upper_shadow=shadow,
        ))

    return events


# ─────────────────────────────────────────────
# 통계 유틸
# ─────────────────────────────────────────────

def summarize(xs: list[float]) -> dict:
    if not xs:
        return {"n": 0, "mean_pct": None, "win_rate": None, "median_pct": None}
    s = sorted(xs)
    n = len(s)
    med = (s[n // 2] + s[(n - 1) // 2]) / 2 * 100
    return {
        "n": n,
        "mean_pct": round(sum(xs) / n * 100, 4),
        "median_pct": round(med, 4),
        "win_rate": round(sum(1 for x in xs if x > 0) / n, 4),
    }


def bootstrap_diff(a: list[float], b: list[float], *, n_boot: int = 3000, seed: int = 42) -> dict:
    rng = random.Random(seed)
    if not a or not b:
        return {"point_pct": None, "ci95": [None, None]}
    pt = (sum(a) / len(a) - sum(b) / len(b)) * 100
    diffs: list[float] = []
    for _ in range(n_boot):
        sa = [rng.choice(a) for _ in a]
        sb = [rng.choice(b) for _ in b]
        diffs.append((sum(sa) / len(sa) - sum(sb) / len(sb)) * 100)
    diffs.sort()
    lo, hi = diffs[int(0.025 * n_boot)], diffs[int(0.975 * n_boot)]
    return {
        "point_pct": round(pt, 4),
        "ci95": [round(lo, 4), round(hi, 4)],
        "likely_real": (lo > 0 or hi < 0),   # CI가 0을 안 가름 = 효과 있을 가능성 높음
    }


# ─────────────────────────────────────────────
# 지표별 분석
# ─────────────────────────────────────────────

def analyze_time_band(events: list[Event], h: int) -> dict:
    bands: dict[str, list[float]] = {"pre": [], "intraday": [], "post": []}
    for e in events:
        r = e.r_c.get(h)
        if r is None:
            continue
        if e.time_band in bands:
            bands[e.time_band].append(r)

    # 장전 vs 장중·장후 합산
    others = bands["intraday"] + bands["post"]
    diff_pre = bootstrap_diff(bands["pre"], others)
    diff_post = bootstrap_diff(bands["post"], bands["pre"] + bands["intraday"])

    return {
        "groups": {k: summarize(v) for k, v in bands.items()},
        "diff_pre_vs_rest": diff_pre,
        "diff_post_vs_rest": diff_post,
        "note": "pre=~08:59 KST, intraday=09:00~15:29, post=15:30~ 기준",
    }


def analyze_gap(events: list[Event], h: int) -> dict:
    gap_pos, gap_neg, gap_null = [], [], []
    for e in events:
        r = e.r_c.get(h)
        if r is None or e.gap_up is None:
            continue
        if e.gap_up > 0.02:     # 갭업 2% 초과
            gap_pos.append(r)
        elif e.gap_up < -0.01:  # 갭다운 1% 초과
            gap_neg.append(r)
        else:
            gap_null.append(r)  # 평형 갭

    diff = bootstrap_diff(gap_null + gap_neg, gap_pos)

    return {
        "gap_up_2pct": summarize(gap_pos),
        "gap_flat":    summarize(gap_null),
        "gap_down_1pct": summarize(gap_neg),
        "diff_flat_or_down_minus_gapup": diff,
        "note": "갭업 클수록 진입 C 직전에 이미 올라가 있는 상태 → 수익 불리 가설 검증",
    }


def analyze_shadow(events: list[Event], h: int) -> dict:
    shadow_hi, shadow_lo = [], []
    for e in events:
        r = e.r_c.get(h)
        if r is None or e.upper_shadow is None:
            continue
        if e.upper_shadow >= 0.5:    # 윗꼬리 50% 이상 (차익 실현 신호)
            shadow_hi.append(r)
        else:
            shadow_lo.append(r)

    diff = bootstrap_diff(shadow_lo, shadow_hi)

    return {
        "shadow_ge_50pct": summarize(shadow_hi),
        "shadow_lt_50pct": summarize(shadow_lo),
        "diff_clean_minus_shadow": diff,
        "note": "T0 당일 5분봉 고가·저가·종가 기반 윗꼬리 비율. 0=완전 양봉, 1=전부 윗꼬리",
    }


def analyze_ticker_consistency(events: list[Event], h: int) -> dict:
    """
    티커별: 전체 이벤트에서 '해당 이벤트보다 먼저 나온 기사'의 평균 수익률로 분류.
    (룩어헤드 방지: article_idx 가 더 작은 = 먼저 나온 기사들의 결과만 씀)
    """
    # article_idx 순서로 정렬
    sorted_ev = sorted(events, key=lambda e: e.article_idx)

    # 티커별 누적 수익률 (이전까지만)
    ticker_acc: dict[str, list[float]] = {}
    result_pos: list[float] = []   # 과거 평균이 양수였던 종목의 이번 수익
    result_neg: list[float] = []   # 과거 평균이 음수였던 종목의 이번 수익
    result_new: list[float] = []   # 첫 등장 종목

    for e in sorted_ev:
        r = e.r_c.get(h)
        if r is None:
            continue
        past = ticker_acc.get(e.ticker, [])
        if not past:
            result_new.append(r)
        elif sum(past) / len(past) > 0:
            result_pos.append(r)
        else:
            result_neg.append(r)
        # 현재 이벤트 수익 누적
        ticker_acc.setdefault(e.ticker, []).append(r)

    diff = bootstrap_diff(result_pos, result_neg)

    return {
        "past_positive_ticker": summarize(result_pos),
        "past_negative_ticker": summarize(result_neg),
        "first_time_ticker": summarize(result_new),
        "diff_past_pos_minus_past_neg": diff,
        "note": "룩어헤드 없음: article_idx 순서대로 처리, 해당 이벤트 이전 기사 결과만 참조",
    }


# ─────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────

def run() -> None:
    print("이벤트 수집 중...")
    events = collect_events()
    print(f"  수집 완료: {len(events):,}건")

    now = datetime.now().isoformat()
    out: dict = {
        "generated_at": now,
        "n_events": len(events),
        "outcome": "진입 C (T+1 장종 5분봉 종가) 기준 수익률",
        "entry_definition": "청산 = 각 진입일로부터 N거래일 뒤 장종 5분봉 종가",
        "factors": {},
    }

    for h in HOLD_DAYS_CHECK:
        label = f"hold_{h}d"
        print(f"  ─ 보유 {h}거래일 분석...")
        out["factors"][label] = {
            "hold_days": h,
            "factor_1_time_band":        analyze_time_band(events, h),
            "factor_2_t1_gap_up":        analyze_gap(events, h),
            "factor_3_upper_shadow_t0":  analyze_shadow(events, h),
            "factor_4_ticker_past_sign": analyze_ticker_consistency(events, h),
        }

    # 요약 테이블 (사람이 읽기 쉽도록)
    summary_rows = []
    for h_label, hdata in out["factors"].items():
        h = hdata["hold_days"]
        f1 = hdata["factor_1_time_band"]
        f2 = hdata["factor_2_t1_gap_up"]
        f3 = hdata["factor_3_upper_shadow_t0"]
        f4 = hdata["factor_4_ticker_past_sign"]

        summary_rows.append({
            "hold_days": h,
            "factors": [
                {
                    "name": "① 발행 시간대 — 장전 vs 기타",
                    "group_a": f1["groups"]["pre"],
                    "group_b": {
                        "n": f1["groups"]["intraday"]["n"] + f1["groups"]["post"]["n"],
                        "mean_pct": None,
                    },
                    "diff": f1["diff_pre_vs_rest"],
                    "verdict": "CI가 0 안 가름 → 유의" if f1["diff_pre_vs_rest"].get("likely_real") else "CI 0 가름 → 불확실",
                },
                {
                    "name": "② T+1 갭업 2% 초과 — 갭 없음·갭다운 vs 갭업",
                    "group_a": {**f2["gap_flat"], "label": "갭 없음"},
                    "group_b": {**f2["gap_up_2pct"], "label": "갭업 2%+"},
                    "diff": f2["diff_flat_or_down_minus_gapup"],
                    "verdict": "CI가 0 안 가름 → 유의" if f2["diff_flat_or_down_minus_gapup"].get("likely_real") else "CI 0 가름 → 불확실",
                },
                {
                    "name": "③ T0 윗꼬리 50% 미만 vs 이상",
                    "group_a": {**f3["shadow_lt_50pct"], "label": "양봉(윗꼬리 작음)"},
                    "group_b": {**f3["shadow_ge_50pct"], "label": "윗꼬리 큼"},
                    "diff": f3["diff_clean_minus_shadow"],
                    "verdict": "CI가 0 안 가름 → 유의" if f3["diff_clean_minus_shadow"].get("likely_real") else "CI 0 가름 → 불확실",
                },
                {
                    "name": "④ 종목 과거 반응 — 과거 양성 vs 음성 티커",
                    "group_a": {**f4["past_positive_ticker"], "label": "과거 평균+"},
                    "group_b": {**f4["past_negative_ticker"], "label": "과거 평균-"},
                    "diff": f4["diff_past_pos_minus_past_neg"],
                    "verdict": "CI가 0 안 가름 → 유의" if f4["diff_past_pos_minus_past_neg"].get("likely_real") else "CI 0 가름 → 불확실",
                },
            ],
        })
    out["summary"] = summary_rows

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"저장 완료: {OUT_JSON}")

    # 터미널 요약 출력
    print("\n" + "=" * 60)
    print("  신호 지표 검증 결과 요약")
    print("=" * 60)
    for row in summary_rows:
        h = row["hold_days"]
        print(f"\n▶ 보유 {h}거래일")
        for f in row["factors"]:
            ga = f.get("group_a", {})
            gb = f.get("group_b", {})
            diff = f.get("diff", {})
            pt = diff.get("point_pct")
            ci = diff.get("ci95", [None, None])
            verdict = f.get("verdict", "")
            ga_label = ga.get("label", "집단 A")
            gb_label = gb.get("label", "집단 B")
            print(f"  {f['name']}")
            print(f"    {ga_label}: n={ga.get('n','?')}, 평균={ga.get('mean_pct','?')}%, 승률={ga.get('win_rate','?')}")
            print(f"    {gb_label}: n={gb.get('n','?')}, 평균={gb.get('mean_pct','?')}%, 승률={gb.get('win_rate','?')}")
            if pt is not None:
                print(f"    평균차: {pt:+.3f}%p  95%CI: [{ci[0]}, {ci[1]}]  → {verdict}")
            print()


if __name__ == "__main__":
    run()
