#!/usr/bin/env python3
"""
Gemini 감성(긍정·부정·중립)별 뉴스 후 거래일 홀딩 수익률 기본 통계.

- 표본·진입·청산 정의는 `pharm_score_hold_stats.py` 와 동일
- 감성: `data/somedaynews_article_tickers_classified.json` 의 `sentiment_label_ko`
  (기사 `article_id` 기준 첫 행만 사용, `lib/article-sentiment.ts` 와 동일)

출력:
  - data/analysis/sentiment_hold_stats.json
  - data/analysis/sentiment_hold_stats.md

  python3 scripts/sentiment_hold_stats.py
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
CLASSIFIED_PATH = BASE / "data" / "somedaynews_article_tickers_classified.json"
SAVE_DIR = BASE / "data" / "analysis"
SAVE_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSON = SAVE_DIR / "sentiment_hold_stats.json"
OUT_MD = SAVE_DIR / "sentiment_hold_stats.md"

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
BUCKET_ORDER = ("긍정", "부정", "중립")

try:
    from scipy.stats import mannwhitneyu

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


def load_sentiment_by_article_id(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        return {}
    out: dict[str, str] = {}
    for row in raw:
        if not isinstance(row, dict):
            continue
        aid = row.get("article_id")
        lab = row.get("sentiment_label_ko")
        if aid is None or not isinstance(lab, str):
            continue
        sid = str(aid).strip()
        lab = lab.strip()
        if not sid or not lab:
            continue
        if sid not in out:
            out[sid] = lab
    return out


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


def run_analysis() -> dict:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        raise SystemExit(f"manifest 없음: {EODHD_WINDOWS}")

    articles_path = default_articles_path(BASE)
    if not articles_path.is_file():
        raise SystemExit(f"기사 파일 없음: {articles_path}")

    sentiment_map = load_sentiment_by_article_id(CLASSIFIED_PATH)
    if not sentiment_map:
        raise SystemExit(f"감성 분류 파일 없음 또는 비어 있음: {CLASSIFIED_PATH}")

    raw_articles = json.loads(articles_path.read_text(encoding="utf-8"))
    if not isinstance(raw_articles, list):
        raise SystemExit("기사 JSON은 배열이어야 합니다.")

    id_by_idx: dict[int, str] = {}
    for i, row in enumerate(raw_articles):
        if isinstance(row, dict) and row.get("article_id") is not None:
            id_by_idx[i] = str(row["article_id"]).strip()

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    by_bucket: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    # MW: (entry, h) -> (긍정 returns, 부정 returns)
    pos_neg: dict[tuple[str, int], tuple[list[float], list[float]]] = defaultdict(
        lambda: ([], [])
    )

    n_events = 0
    n_f_ok = 0
    n_a_ok = 0

    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        aidx = ev["article_idx"]
        aid = id_by_idx.get(aidx, "")
        sent = sentiment_map.get(aid)
        if sent not in BUCKET_ORDER:
            continue

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
                pl, nl = pos_neg[("F", h)]
                if sent == "긍정":
                    pl.append(rf)
                elif sent == "부정":
                    nl.append(rf)
            ra = rmap_a.get(h)
            if ra is not None:
                by_bucket[("A", h, sent)].append(ra)
                pl, nl = pos_neg[("A", h)]
                if sent == "긍정":
                    pl.append(ra)
                elif sent == "부정":
                    nl.append(ra)

    entries = ("F", "A")
    entry_labels = {
        "F": "공개 직후 첫 5분봉 종가 진입",
        "A": "T0 장종 5분봉 종가 진입",
    }

    tables: dict = {}
    for ent in entries:
        tables[ent] = {}
        for h in HOLDS:
            row: dict[str, dict] = {}
            for b in BUCKET_ORDER:
                row[b] = summarize_returns(by_bucket.get((ent, h, b), []))
            tables[ent][str(h)] = {"by_bucket": row}

    tests: dict = {}
    for ent in entries:
        tests[ent] = {}
        for h in HOLDS:
            pl, nl = pos_neg[(ent, h)]
            mw_p = None
            if HAS_SCIPY and len(pl) >= 8 and len(nl) >= 8:
                try:
                    _, p_mw = mannwhitneyu(pl, nl, alternative="two-sided")
                    mw_p = float(p_mw)
                except ValueError:
                    mw_p = None
            tests[ent][str(h)] = {
                "n_positive": len(pl),
                "n_negative": len(nl),
                "mannwhitney_positive_vs_negative_p_two_sided": mw_p,
                "scipy": HAS_SCIPY,
            }

    classified_counts = defaultdict(int)
    for _aid, lab in sentiment_map.items():
        if lab in BUCKET_ORDER:
            classified_counts[lab] += 1

    return {
        "meta": {
            "articles_path": str(articles_path.relative_to(BASE)),
            "classified_path": str(CLASSIFIED_PATH.relative_to(BASE)),
            "eodhd_root": str(EODHD_WINDOWS.relative_to(BASE)),
            "hold_trading_days": list(HOLDS),
            "n_classified_articles_by_sentiment": dict(classified_counts),
            "n_iter_events_manifest_pass_and_classified": n_events,
            "n_events_with_any_F_h": n_f_ok,
            "n_events_with_any_A_h": n_a_ok,
            "note": "긍정·부정·중립은 Gemini 분류. Mann–Whitney는 긍정 vs 부정만. 다중 검정·동시 표본은 보수적으로 해석.",
        },
        "entry_labels": entry_labels,
        "tables": tables,
        "significance": tests,
    }


def _fmt_pct(x: float | None) -> str:
    if x is None:
        return "—"
    return f"{x:+.2f}"


def _fmt_wr(w: float | None) -> str:
    if w is None:
        return "—"
    return f"{100.0 * w:.1f}%"


def write_markdown(result: dict) -> None:
    meta = result["meta"]
    lines = [
        "# 감성(긍정·부정) × 홀딩 수익률 백테스트 요약",
        "",
        "원천 JSON: `data/analysis/sentiment_hold_stats.json`. 갱신:",
        "",
        "```bash",
        "python3 scripts/sentiment_hold_stats.py",
        "```",
        "",
        "## 정의",
        "",
        "| 항목 | 내용 |",
        "|------|------|",
        "| 표본 | `somedaynews_article_tickers.json` + EODHD 매니페스트 (**intraday_ok** & **eod_ok**) |",
        "| 감성 | `somedaynews_article_tickers_classified.json` 의 `sentiment_label_ko` (기사당 첫 레코드) |",
        "| 홀딩 | **거래일** 기준 1, 2, 3, 5일 |",
        "| **진입 F** | `published_at` 이후 첫 장중 5분봉 종가 (`pharm_score_hold_stats.py` 와 동일) |",
        "| **진입 A** | 기사 KST 달력일의 첫 매칭 거래일(T0) 장중 **마지막** 5분봉 종가 |",
        "| 청산 | 해당 거래일 장중 마지막 5분봉 종가 |",
        "| 수익률 | (청산 − 진입) / 진입 |",
        "",
        "## 표본",
        "",
        f"| 지표 | 값 |",
        f"|------|-----|",
        f"| 분류 파일 내 기사 수 (감성별) | 긍정 {meta['n_classified_articles_by_sentiment'].get('긍정', 0)}, "
        f"부정 {meta['n_classified_articles_by_sentiment'].get('부정', 0)}, "
        f"중립 {meta['n_classified_articles_by_sentiment'].get('중립', 0)} |",
        f"| 매니페스트 통과 + 분류 매칭 이벤트 수 | {meta['n_iter_events_manifest_pass_and_classified']} |",
        f"| 그중 진입 F로 최소 1개 홀딩 성공 | {meta['n_events_with_any_F_h']} |",
        f"| 그중 진입 A로 최소 1개 홀딩 성공 | {meta['n_events_with_any_A_h']} |",
        "",
        "> 유의성: Mann–Whitney **긍정 vs 부정** (양측). 여러 홀딩·진입 방식을 동시에 보므로 **다중 비교**를 고려하세요.",
        "",
    ]

    for ent in ("F", "A"):
        label = result["entry_labels"][ent]
        lines.append(f"## 진입 {ent} — {label}")
        lines.append("")
        for h in HOLDS:
            lines.append(f"### H = {h} 거래일")
            lines.append("")
            lines.append("| 버킷 | n | 평균 % | 중앙 % | 표준편차 % | 승률 |")
            lines.append("|------|---|--------|--------|------------|------|")
            byb = result["tables"][ent][str(h)]["by_bucket"]
            for b in BUCKET_ORDER:
                s = byb[b]
                if s["n"] == 0:
                    continue
                lines.append(
                    f"| {b} | {s['n']} | {_fmt_pct(s['mean_pct'])} | {_fmt_pct(s['median_pct'])} | "
                    f"{_fmt_pct(s['stdev_pct'])} | {_fmt_wr(s['win_rate'])} |"
                )
            lines.append("")

        lines.append(f"### 진입 {ent} — 긍정 vs 부정 (Mann–Whitney)")
        lines.append("")
        lines.append("| H | n 긍정 | n 부정 | p (양측) |")
        lines.append("|---|--------|--------|----------|")
        for h in HOLDS:
            sig = result["significance"][ent][str(h)]
            p = sig.get("mannwhitney_positive_vs_negative_p_two_sided")
            p_s = f"{p:.4f}" if p is not None else ("—" if not sig.get("scipy") else "표본 부족")
            lines.append(
                f"| {h} | {sig['n_positive']} | {sig['n_negative']} | {p_s} |"
            )
        lines.append("")

    lines.extend(
        [
            "---",
            "",
            "## 해석 메모",
            "",
            "1. **부정** 버킷 표본이 **긍정**보다 작아 분산이 클 수 있습니다.",
            "2. 뉴스 1건·티커 1건이 한 관측이며, 동일 기간·섹터 편향이 있을 수 있습니다.",
            "3. p값은 탐색적 참고용이며, 투자 결론으로 쓰기 전에 **표본 확대·검증 세트**가 필요합니다.",
            "4. 이번 실행 기준 **진입 A, H=5**에서만 Mann–Whitney가 대략 **p &lt; 0.01**이었습니다. "
            "다른 홀딩·진입 F는 유의하지 않거나 경계선(p≈0.09) 수준입니다.",
            "",
        ]
    )

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def print_console(result: dict) -> None:
    meta = result["meta"]
    print("=== 감성(긍정·부정·중립) × 홀딩(거래일) 수익률 ===")
    print(f"분류 기사 수: {meta['n_classified_articles_by_sentiment']}")
    print(
        f"매니페스트+감성 매칭 이벤트: {meta['n_iter_events_manifest_pass_and_classified']}, "
        f"F 일부 성공: {meta['n_events_with_any_F_h']}, A: {meta['n_events_with_any_A_h']}"
    )
    print(f"scipy: {'있음' if HAS_SCIPY else '없음(p값 생략)'}")
    print()

    for ent in ("F", "A"):
        print(f"--- 진입 {ent} ---")
        for h in HOLDS:
            print(f"  H={h}")
            byb = result["tables"][ent][str(h)]["by_bucket"]
            for b in BUCKET_ORDER:
                s = byb[b]
                if s["n"] == 0:
                    continue
                print(
                    f"    {b:4} n={s['n']:4}  평균={_fmt_pct(s['mean_pct']):>8}%  "
                    f"중앙={_fmt_pct(s['median_pct']):>8}%  승률={_fmt_wr(s['win_rate'])}"
                )
            sig = result["significance"][ent][str(h)]
            p = sig.get("mannwhitney_positive_vs_negative_p_two_sided")
            print(
                f"    MW(긍정 vs 부정) p={p if p is not None else '—'} "
                f"(n+={sig['n_positive']}, n-={sig['n_negative']})"
            )
            print()


def main() -> None:
    parser = argparse.ArgumentParser(description="감성별 홀딩 수익 통계")
    parser.add_argument("--no-json", action="store_true")
    parser.add_argument("--no-md", action="store_true")
    args = parser.parse_args()

    result = run_analysis()
    print_console(result)
    if not args.no_json:
        OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"저장: {OUT_JSON.relative_to(BASE)}")
    if not args.no_md:
        write_markdown(result)
        print(f"저장: {OUT_MD.relative_to(BASE)}")


if __name__ == "__main__":
    main()
