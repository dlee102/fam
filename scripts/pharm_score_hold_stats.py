#!/usr/bin/env python3
"""
팜이데일리 API `score`(클수록 좋음)별, 뉴스 후 거래일 홀딩 수익률 기본 통계.

- 표본: `somedaynews_article_tickers.json` + EODHD manifest (intraday_ok & eod_ok)
- 진입: **F** — `published_at` 이후 첫 장중 5분봉 종가 (`entry_hold_analysis` / `analyze_10m` 와 동일)
- 청산: 진입일이 EOD `bars[i_entry]`일 때, **i_entry + h** 거래일 장중 마지막 5분봉 종가 (h = 1,2,3,5)
- 참고: **A** — T0(기사 KST 달력일 첫 매칭 거래일) 장종 5분봉 종가 진입, 청산 `i0 + h`

출력:
  - stdout: 요약 표
  - data/analysis/pharm_score_hold_stats.json

  python3 scripts/pharm_score_hold_stats.py
  python3 scripts/pharm_score_hold_stats.py --no-json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import mean, median, pstdev

BASE = Path(__file__).resolve().parent.parent
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
SAVE_DIR = BASE / "data" / "analysis"
SAVE_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSON = SAVE_DIR / "pharm_score_hold_stats.json"

sys.path.insert(0, str(BASE / "scripts"))
from excluded_tickers import is_excluded
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
from entry_hold_analysis import (
    _cached_eod_bars,
    _cached_intra_bars,
    eod_index_for_session_ymd,
    eod_index_on_or_after,
    first_close_after_publish_on_calendar,
    last_intraday_session_close,
    valid_ticker,
)
from analyze_10m_return_path import parse_publish_utc_naive

HOLDS = (1, 2, 3, 5)

try:
    from scipy.stats import kruskal, mannwhitneyu, spearmanr

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


def norm_score(raw: object) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if not isinstance(raw, bool) else None
    if isinstance(raw, float):
        if math.isnan(raw):
            return None
        return int(raw) if raw == int(raw) else None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return int(float(s))
        except ValueError:
            return None


def sell_at_eod_index(all_intra: list, bars: list, sell_i: int) -> float | None:
    if sell_i >= len(bars):
        return None
    sd = bars[sell_i]["date"]
    return last_intraday_session_close(all_intra, sd)


def compute_returns_f(
    *,
    all_intra: list,
    bars: list,
    t0_d: date,
    published_at: str,
) -> tuple[int | None, dict[int, float]]:
    """Returns (i_entry_f or None, {h: return})."""
    out: dict[int, float] = {}
    try:
        pu = parse_publish_utc_naive(published_at.strip())
    except (ValueError, TypeError):
        return None, out
    got = first_close_after_publish_on_calendar(all_intra, t0_d, pu)
    if not got:
        return None, out
    c_f, dk_f = got
    idx_f = eod_index_for_session_ymd(bars, dk_f)
    if idx_f is None or c_f <= 0:
        return None, out
    for h in HOLDS:
        si = idx_f + h
        sp = sell_at_eod_index(all_intra, bars, si)
        if sp is not None and sp > 0:
            out[h] = (sp - c_f) / c_f
    return idx_f, out


def compute_returns_a(
    *,
    all_intra: list,
    bars: list,
    i0: int,
    t0_date: str,
) -> dict[int, float]:
    out: dict[int, float] = {}
    px_a = last_intraday_session_close(all_intra, t0_date)
    if px_a is None or px_a <= 0:
        return out
    for h in HOLDS:
        si = i0 + h
        sp = sell_at_eod_index(all_intra, bars, si)
        if sp is not None and sp > 0:
            out[h] = (sp - px_a) / px_a
    return out


def summarize_returns(rets: list[float]) -> dict:
    arr = [r for r in rets if r is not None and isinstance(r, (int, float)) and not math.isnan(r)]
    if not arr:
        return {"n": 0, "mean_pct": None, "median_pct": None, "stdev_pct": None, "win_rate": None}
    wins = sum(1 for r in arr if r > 0)
    return {
        "n": len(arr),
        "mean_pct": round(100.0 * mean(arr), 4),
        "median_pct": round(100.0 * median(arr), 4),
        "stdev_pct": round(100.0 * pstdev(arr), 4) if len(arr) > 1 else 0.0,
        "win_rate": round(wins / len(arr), 4),
    }


def bucket_label(s: int | None) -> str:
    if s is None:
        return "score_null"
    return f"score_{s}"


def run_analysis(*, entry_primary: str = "F") -> dict:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        raise SystemExit(f"manifest 없음: {EODHD_WINDOWS}")

    articles_path = default_articles_path(BASE)
    if not articles_path.is_file():
        raise SystemExit(f"기사 파일 없음: {articles_path}")

    raw = json.loads(articles_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("기사 JSON은 배열이어야 합니다.")

    score_by_article_idx: dict[int, int | None] = {}
    for i, row in enumerate(raw):
        if isinstance(row, dict):
            score_by_article_idx[i] = norm_score(row.get("score"))

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    # (entry_tag, h, bucket) -> list of returns
    by_bucket: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    # (entry_tag, h) -> list of (score_int|None, ret) for correlation / tests
    pairs: dict[tuple[str, int], list[tuple[int | None, float]]] = defaultdict(list)

    n_events = 0
    n_f_ok = 0
    n_a_ok = 0

    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        idx = ev["article_idx"]
        sc = score_by_article_idx.get(idx)
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        t0_str = ev["t0"]
        rel = m.get("intraday_path")
        eod_rel = m.get("eod_path")
        if not ticker or not t0_str or not rel or not eod_rel:
            continue
        if not valid_ticker(ticker) or is_excluded(ticker):
            continue

        eod_file = EODHD_WINDOWS / eod_rel
        intra_file = EODHD_WINDOWS / rel
        if not eod_file.is_file() or not intra_file.is_file():
            continue

        bars = _cached_eod_bars(eod_rel)
        all_intra = _cached_intra_bars(rel)
        t0_d = date.fromisoformat(t0_str)
        i0 = eod_index_on_or_after(bars, t0_d)
        if i0 is None:
            continue

        n_events += 1
        t0_date = bars[i0]["date"]

        _, rmap_f = compute_returns_f(
            all_intra=all_intra,
            bars=bars,
            t0_d=t0_d,
            published_at=ev["published_at"],
        )
        if rmap_f:
            n_f_ok += 1
        rmap_a = compute_returns_a(all_intra=all_intra, bars=bars, i0=i0, t0_date=t0_date)
        if rmap_a:
            n_a_ok += 1

        bl = bucket_label(sc)
        for h in HOLDS:
            rf = rmap_f.get(h)
            if rf is not None:
                by_bucket[("F", h, bl)].append(rf)
                pairs[("F", h)].append((sc, rf))
            ra = rmap_a.get(h)
            if ra is not None:
                by_bucket[("A", h, bl)].append(ra)
                pairs[("A", h)].append((sc, ra))

    # Aggregate tables
    entries = ("F", "A")
    entry_labels = {
        "F": "공개 직후 첫 5분봉 종가 진입",
        "A": "T0 장종 5분봉 종가 진입",
    }

    tables: dict = {}
    for ent in entries:
        tables[ent] = {}
        for h in HOLDS:
            buckets_found = sorted({k[2] for k in by_bucket if k[0] == ent and k[1] == h})
            tables[ent][str(h)] = {
                "by_bucket": {b: summarize_returns(by_bucket[(ent, h, b)]) for b in buckets_found},
            }

    # Tests per (entry, h): Spearman (score vs return, drop null score)
    # Mann-Whitney: score >= 4 vs 2 <= score <= 3 (exclude null and score 5-only small n — include 5 in high)
    tests: dict = {}
    for ent in entries:
        tests[ent] = {}
        for h in HOLDS:
            pr = pairs[(ent, h)]
            scored = [(s, r) for s, r in pr if s is not None]
            high = [r for s, r in scored if s >= 4]
            low = [r for s, r in scored if 2 <= s <= 3]
            xs = [s for s, _ in scored]
            ys = [r for _, r in scored]
            spearman_rho = spearman_p = mw_p = kw_p = None
            if HAS_SCIPY and len(xs) >= 8:
                rho, psp = spearmanr(xs, ys)
                spearman_rho = float(rho) if rho == rho else None
                spearman_p = float(psp) if psp == psp else None
            if HAS_SCIPY and len(high) >= 8 and len(low) >= 8:
                _, p_mw = mannwhitneyu(high, low, alternative="two-sided")
                mw_p = float(p_mw)
            # Kruskal: score 2,3,4,5 only
            groups = [[r for s, r in scored if s == g] for g in (2, 3, 4, 5)]
            groups = [g for g in groups if len(g) >= 3]
            if HAS_SCIPY and len(groups) >= 2:
                try:
                    _, p_kw = kruskal(*groups)
                    kw_p = float(p_kw)
                except ValueError:
                    kw_p = None

            tests[ent][str(h)] = {
                "n_with_score": len(scored),
                "n_score_null": sum(1 for s, _ in pr if s is None),
                "spearman_rho": spearman_rho,
                "spearman_p_two_sided": spearman_p,
                "mannwhitney_high_ge4_vs_mid_2_3_p_two_sided": mw_p,
                "n_high_ge4": len(high),
                "n_mid_2_3": len(low),
                "kruskal_score_2_3_4_5_p": kw_p,
                "scipy": HAS_SCIPY,
            }

    return {
        "meta": {
            "articles_path": str(articles_path.relative_to(BASE)),
            "eodhd_root": str(EODHD_WINDOWS.relative_to(BASE)),
            "hold_trading_days": list(HOLDS),
            "n_iter_events": n_events,
            "n_events_with_any_F_h": n_f_ok,
            "n_events_with_any_A_h": n_a_ok,
            "note": "score 높을수록 API상 노출 가중(클수록 좋음). 유의성은 p<0.05 참고; 다중 검정·동시 표본은 보수적으로 해석.",
        },
        "entry_labels": entry_labels,
        "tables": tables,
        "significance": tests,
    }


def print_console(result: dict) -> None:
    meta = result["meta"]
    print("=== 팜이데일리 score × 홀딩(거래일) 수익률 ===")
    print(f"이벤트(매니페스트 통과): {meta['n_iter_events']}, F 경로 일부 성공: {meta['n_events_with_any_F_h']}")
    print(f"scipy: {'있음' if HAS_SCIPY else '없음(p값 생략)'}")
    print()

    for ent in ("F", "A"):
        label = result["entry_labels"][ent]
        print(f"--- 진입 {ent}: {label} ---")
        for h in HOLDS:
            print(f"  H={h} 거래일")
            byb = result["tables"][ent][str(h)]["by_bucket"]
            for bkey in sorted(byb.keys(), key=lambda x: (x == "score_null", x)):
                s = byb[bkey]
                if s["n"] == 0:
                    continue
                print(
                    f"    {bkey:12} n={s['n']:4}  평균={s['mean_pct']:+7.3f}%  "
                    f"중앙={s['median_pct']:+7.3f}%  승률={100*s['win_rate']:.1f}%"
                )
            sig = result["significance"][ent][str(h)]
            if sig.get("spearman_rho") is not None:
                print(
                    f"    Spearman ρ={sig['spearman_rho']:.4f} p={sig.get('spearman_p_two_sided')}, "
                    f"MW(high≥4 vs 2–3) p={sig.get('mannwhitney_high_ge4_vs_mid_2_3_p_two_sided')} "
                    f"(n_high={sig['n_high_ge4']}, n_mid={sig['n_mid_2_3']}), "
                    f"Kruskal(2–5) p={sig.get('kruskal_score_2_3_4_5_p')}"
                )
            print()
        print()


def main() -> None:
    parser = argparse.ArgumentParser(description="score별 홀딩 수익 통계")
    parser.add_argument("--no-json", action="store_true")
    args = parser.parse_args()

    result = run_analysis()
    print_console(result)
    if not args.no_json:
        OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"저장: {OUT_JSON.relative_to(BASE)}")


if __name__ == "__main__":
    main()
