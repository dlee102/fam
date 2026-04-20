#!/usr/bin/env python3
"""
Gemini 분류 감성(긍정/부정/중립)별 뉴스 후 거래일 홀딩 수익률.

- 입력: `data/somedaynews_article_tickers_classified.json` (행 순서·article_idx는
  `somedaynews_article_tickers.json`과 동일해야 per-article 매니페스트와 맞음)
- 매니페스트·진입 F/A·홀딩 정의는 `pharm_score_hold_stats.py` 와 동일

모드:
  --mode row     티커 펼친 행마다 1표본 (기본)
  --mode article 동일 article_id는 첫 행만 1표본

출력:
  data/analysis/pharm_sentiment_hold_stats.json
  data/analysis/pharm_sentiment_hold_stats.md  (--no-md 로 생략)

  python3 scripts/pharm_sentiment_hold_stats.py
  python3 scripts/pharm_sentiment_hold_stats.py --mode article
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
SAVE_DIR = BASE / "data" / "analysis"
SAVE_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_CLASSIFIED = BASE / "data" / "somedaynews_article_tickers_classified.json"

sys.path.insert(0, str(BASE / "scripts"))
from excluded_tickers import is_excluded
from news_article_events import iter_article_ticker_events, resolve_manifest_sources
from entry_hold_analysis import (
    _cached_eod_bars,
    _cached_intra_bars,
    eod_index_on_or_after,
    last_intraday_session_close,
    valid_ticker,
)
from pharm_score_hold_stats import HOLDS, compute_returns_a, compute_returns_f, summarize_returns

try:
    from scipy.stats import kruskal, mannwhitneyu, spearmanr

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

SENT_ORD = {"negative": -1, "neutral": 0, "positive": 1}
BUCKET_ORDER = ("positive", "negative", "neutral", "unknown")


def norm_sentiment(row: dict) -> str:
    s = row.get("sentiment")
    if isinstance(s, str):
        sl = s.strip().lower()
        if sl in ("positive", "negative", "neutral"):
            return sl
    ko = row.get("sentiment_label_ko")
    if isinstance(ko, str):
        m = {"긍정": "positive", "부정": "negative", "중립": "neutral"}.get(ko.strip())
        if m:
            return m
    return "unknown"


def first_row_indices_by_article(raw: list) -> set[int]:
    seen: set[str] = set()
    out: set[int] = set()
    for i, row in enumerate(raw):
        if not isinstance(row, dict):
            continue
        aid = row.get("article_id")
        if aid is None:
            continue
        key = str(aid).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.add(i)
    return out


def run_sentiment_analysis(*, articles_path: Path, mode: str) -> dict:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        raise SystemExit(f"manifest 없음: {EODHD_WINDOWS}")
    if not articles_path.is_file():
        raise SystemExit(f"기사 파일 없음: {articles_path}")

    raw = json.loads(articles_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("기사 JSON은 배열이어야 합니다.")

    sentiment_by_idx: dict[int, str] = {}
    for i, row in enumerate(raw):
        if isinstance(row, dict):
            sentiment_by_idx[i] = norm_sentiment(row)

    allowed_idx: set[int] | None = None
    if mode == "article":
        allowed_idx = first_row_indices_by_article(raw)
    elif mode != "row":
        raise SystemExit("--mode 는 row 또는 article")

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    by_bucket: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    # tests: ordinal sentiment vs return
    pairs_ord: dict[tuple[str, int], list[tuple[int, float]]] = defaultdict(list)

    n_events = 0
    n_f_ok = 0
    n_a_ok = 0
    skipped_not_allowed = 0

    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        idx = ev["article_idx"]
        if allowed_idx is not None and idx not in allowed_idx:
            skipped_not_allowed += 1
            continue

        sent = sentiment_by_idx.get(idx, "unknown")
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

        for h in HOLDS:
            rf = rmap_f.get(h)
            if rf is not None:
                by_bucket[("F", h, sent)].append(rf)
                if sent in SENT_ORD:
                    pairs_ord[("F", h)].append((SENT_ORD[sent], rf))
            ra = rmap_a.get(h)
            if ra is not None:
                by_bucket[("A", h, sent)].append(ra)
                if sent in SENT_ORD:
                    pairs_ord[("A", h)].append((SENT_ORD[sent], ra))

    entries = ("F", "A")
    entry_labels = {
        "F": "공개 직후 첫 5분봉 종가 진입",
        "A": "T0 장종 5분봉 종가 진입",
    }

    tables: dict = {}
    for ent in entries:
        tables[ent] = {}
        for h in HOLDS:
            buckets_found = [b for b in BUCKET_ORDER if (ent, h, b) in by_bucket]
            buckets_found += sorted(
                {k[2] for k in by_bucket if k[0] == ent and k[1] == h and k[2] not in BUCKET_ORDER}
            )
            tables[ent][str(h)] = {
                "by_bucket": {b: summarize_returns(by_bucket[(ent, h, b)]) for b in buckets_found},
            }

    tests: dict = {}
    for ent in entries:
        tests[ent] = {}
        for h in HOLDS:
            pr = pairs_ord[(ent, h)]
            xs = [x for x, _ in pr]
            ys = [y for _, y in pr]
            spearman_rho = spearman_p = None
            if HAS_SCIPY and len(xs) >= 8:
                rho, psp = spearmanr(xs, ys)
                spearman_rho = float(rho) if rho == rho else None
                spearman_p = float(psp) if psp == psp else None

            pos = [r for o, r in pr if o == 1]
            neg = [r for o, r in pr if o == -1]
            neu = [r for o, r in pr if o == 0]

            mw_pos_neg = mw_pos_neu = mw_neg_neu = None
            if HAS_SCIPY and len(pos) >= 8 and len(neg) >= 8:
                _, p = mannwhitneyu(pos, neg, alternative="two-sided")
                mw_pos_neg = float(p)
            if HAS_SCIPY and len(pos) >= 8 and len(neu) >= 8:
                _, p = mannwhitneyu(pos, neu, alternative="two-sided")
                mw_pos_neu = float(p)
            if HAS_SCIPY and len(neg) >= 8 and len(neu) >= 8:
                _, p = mannwhitneyu(neg, neu, alternative="two-sided")
                mw_neg_neu = float(p)

            groups = [g for g in (pos, neg, neu) if len(g) >= 3]
            kw_p = None
            if HAS_SCIPY and len(groups) >= 2:
                try:
                    _, p_kw = kruskal(*groups)
                    kw_p = float(p_kw)
                except ValueError:
                    kw_p = None

            tests[ent][str(h)] = {
                "n_scored_triplet": len(pr),
                "n_positive": len(pos),
                "n_negative": len(neg),
                "n_neutral": len(neu),
                "spearman_ordinal_neg0pos_p": spearman_p,
                "spearman_rho": spearman_rho,
                "mannwhitney_positive_vs_negative_p": mw_pos_neg,
                "mannwhitney_positive_vs_neutral_p": mw_pos_neu,
                "mannwhitney_negative_vs_neutral_p": mw_neg_neu,
                "kruskal_positive_negative_neutral_p": kw_p,
                "scipy": HAS_SCIPY,
            }

    return {
        "meta": {
            "articles_path": str(articles_path.relative_to(BASE)),
            "mode": mode,
            "eodhd_root": str(EODHD_WINDOWS.relative_to(BASE)),
            "hold_trading_days": list(HOLDS),
            "n_iter_events_after_mode_filter": n_events,
            "skipped_events_wrong_article_row": skipped_not_allowed,
            "n_events_with_any_F_h": n_f_ok,
            "n_events_with_any_A_h": n_a_ok,
            "note": "감성: JSON의 sentiment / sentiment_label_ko. 서열은 부정=-1 중립=0 긍정=1 (Spearman 탐색용). "
            "다중 검정 보수적 해석.",
        },
        "entry_labels": entry_labels,
        "tables": tables,
        "significance": tests,
    }


def print_console(result: dict) -> None:
    meta = result["meta"]
    print("=== 감성(긍정/부정/중립) × 홀딩 수익률 ===")
    print(f"모드: {meta['mode']}")
    print(f"이벤트(매니페스트+모드 필터 후): {meta['n_iter_events_after_mode_filter']}")
    if meta.get("skipped_events_wrong_article_row", 0):
        print(f"  (article 모드에서 제외된 행 이벤트: {meta['skipped_events_wrong_article_row']})")
    print(f"F 경로 일부 성공: {meta['n_events_with_any_F_h']}, scipy: {'있음' if HAS_SCIPY else '없음'}")
    print()

    for ent in ("F", "A"):
        print(f"--- 진입 {ent}: {result['entry_labels'][ent]} ---")
        for h in HOLDS:
            print(f"  H={h} 거래일")
            byb = result["tables"][ent][str(h)]["by_bucket"]
            for bkey in BUCKET_ORDER:
                if bkey not in byb:
                    continue
                s = byb[bkey]
                if s["n"] == 0:
                    continue
                print(
                    f"    {bkey:10} n={s['n']:4}  평균={s['mean_pct']:+7.3f}%  "
                    f"중앙={s['median_pct']:+7.3f}%  승률={100*s['win_rate']:.1f}%"
                )
            for bkey, s in sorted(byb.items()):
                if bkey in BUCKET_ORDER:
                    continue
                if s["n"] == 0:
                    continue
                print(
                    f"    {bkey:10} n={s['n']:4}  평균={s['mean_pct']:+7.3f}%  "
                    f"중앙={s['median_pct']:+7.3f}%  승률={100*s['win_rate']:.1f}%"
                )
            sig = result["significance"][ent][str(h)]
            print(
                f"    Spearman(서열) ρ={sig.get('spearman_rho')} p={sig.get('spearman_ordinal_neg0pos_p')}, "
                f"Kruskal(긍·부·중) p={sig.get('kruskal_positive_negative_neutral_p')}, "
                f"MW 긍vs부 p={sig.get('mannwhitney_positive_vs_negative_p')}, "
                f"긍vs중 p={sig.get('mannwhitney_positive_vs_neutral_p')}"
            )
            print()
        print()


def write_md(result: dict, path: Path) -> None:
    meta = result["meta"]
    lines = [
        "# 감성 분류(긍정/부정/중립) × 홀딩 수익률",
        "",
        f"- 데이터: `{meta['articles_path']}`",
        f"- 모드: **{meta['mode']}** (`row` = 티커별 행 전체, `article` = 기사당 첫 행만)",
        f"- 매니페스트 통과 이벤트 수(필터 후): **{meta['n_iter_events_after_mode_filter']}**",
        "",
        "## 진입 정의",
        "",
        "| 코드 | 의미 |",
        "|------|------|",
        f"| F | {result['entry_labels']['F']} |",
        f"| A | {result['entry_labels']['A']} |",
        "",
    ]
    for ent in ("F", "A"):
        lines.append(f"## 진입 {ent}")
        lines.append("")
        for h in HOLDS:
            lines.append(f"### H = {h} 거래일")
            lines.append("")
            lines.append("| 감성 | n | 평균 % | 중앙 % | 승률 |")
            lines.append("|------|---|--------|--------|------|")
            byb = result["tables"][ent][str(h)]["by_bucket"]
            for bkey in list(BUCKET_ORDER) + [k for k in sorted(byb.keys()) if k not in BUCKET_ORDER]:
                if bkey not in byb:
                    continue
                s = byb[bkey]
                if s["n"] == 0:
                    continue
                lines.append(
                    f"| {bkey} | {s['n']} | {s['mean_pct']:+.3f} | {s['median_pct']:+.3f} | {100*s['win_rate']:.1f}% |"
                )
            sig = result["significance"][ent][str(h)]
            lines.append("")
            lines.append(
                f"- Spearman(부정→중립→긍정 서열) p={sig.get('spearman_ordinal_neg0pos_p')}, "
                f"Kruskal p={sig.get('kruskal_positive_negative_neutral_p')}"
            )
            lines.append(
                f"- Mann–Whitney: 긍정 vs 부정 p={sig.get('mannwhitney_positive_vs_negative_p')}, "
                f"긍정 vs 중립 p={sig.get('mannwhitney_positive_vs_neutral_p')}, "
                f"부정 vs 중립 p={sig.get('mannwhitney_negative_vs_neutral_p')}"
            )
            lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="감성별 홀딩 수익 통계")
    parser.add_argument(
        "--articles",
        type=Path,
        default=DEFAULT_CLASSIFIED,
        help="분류 붙은 기사 JSON 경로",
    )
    parser.add_argument("--mode", choices=("row", "article"), default="row")
    parser.add_argument("--no-json", action="store_true")
    parser.add_argument("--no-md", action="store_true")
    args = parser.parse_args()

    result = run_sentiment_analysis(articles_path=args.articles.resolve(), mode=args.mode)
    print_console(result)
    out_json = SAVE_DIR / f"pharm_sentiment_hold_stats_{args.mode}.json"
    out_md = SAVE_DIR / f"pharm_sentiment_hold_stats_{args.mode}.md"
    if not args.no_json:
        out_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"저장: {out_json.relative_to(BASE)}")
    if not args.no_md:
        write_md(result, out_md)
        print(f"저장: {out_md.relative_to(BASE)}")


if __name__ == "__main__":
    main()
