#!/usr/bin/env python3
"""
`entry_hold_analysis` 와 동일한 유니버스 중
**진입 A(T0 장종 5분봉 종가) · 보유 1거래일** 청산이 성립하는 표본(표에서 n≈1350)만 남기고,

발행일(t0) 일봉 시가(첫 거래일 open) 기준 **이후 연속 5거래일** 일봉 고가 최댓값이 +10% 이상인
기사·종목만 추출.

- 코호트: intraday_ok·eod_ok, 제외 티커 아님, T0/T+1 캘린더·5분봉으로 A·1일 청산 가격 산출 가능
- 10% 규칙: t0 구간 첫 봉 open 대비 이후 5거래일 일봉 high 최댓값 ≥ 10%
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from excluded_tickers import is_excluded
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
import entry_hold_analysis as eha

EODHD_WINDOWS = ROOT / "data" / "eodhd_news_windows"
OUT = ROOT / "data" / "analysis" / "publish_5d_high_ge_10pct_entry_a_hold1_cohort.json"
TRADING_DAYS = 5
THRESHOLD_PCT = 10.0


def find_t0_bar_index(bars: list[dict], t0_kst: str) -> int:
    for i, b in enumerate(bars):
        if b.get("date", "") >= t0_kst:
            return i
    return -1


def main() -> int:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if pak is None:
        print("per_article manifest 필요:", EODHD_WINDOWS / "per_article/manifest_per_article.json", file=sys.stderr)
        return 1

    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        print("기사 파일 없음:", articles_path, file=sys.stderr)
        return 1

    cohort = 0
    hits: list[dict] = []

    for ev in iter_article_ticker_events(
        articles_path,
        per_article_by_key=pak,
        require_intraday=True,
        require_eod=True,
    ):
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        t0_str = ev["t0"]
        rel = m.get("intraday_path")
        eod_rel = m.get("eod_path")
        if not ticker or not t0_str or not rel or not eod_rel:
            continue
        if not (len(ticker) == 6 and ticker.isdigit()) or is_excluded(ticker):
            continue

        eod_file = EODHD_WINDOWS / eod_rel
        intra_file = EODHD_WINDOWS / rel
        if not eod_file.is_file() or not intra_file.is_file():
            continue

        bars = eha._cached_eod_bars(eod_rel)
        t0_d = date.fromisoformat(t0_str)
        i0 = eha.eod_index_on_or_after(bars, t0_d)
        if i0 is None or i0 + 1 >= len(bars):
            continue

        all_intra = eha._cached_intra_bars(rel)
        t0_date = bars[i0]["date"]
        px_a = eha.last_intraday_session_close(all_intra, t0_date)
        if px_a is None:
            continue

        def sell_px(sell_i: int) -> float | None:
            if sell_i >= len(bars):
                return None
            sd = bars[sell_i]["date"]
            return eha.last_intraday_session_close(all_intra, sd)

        if sell_px(i0 + 1) is None:
            continue
        cohort += 1

        payload = json.loads(eod_file.read_text(encoding="utf-8"))
        eod_bars = payload.get("bars") or []
        t0 = payload.get("t0_kst") or m.get("t0_kst") or t0_str
        if not eod_bars or not t0:
            continue
        idx = find_t0_bar_index(eod_bars, t0)
        if idx < 0:
            continue
        window = eod_bars[idx : idx + TRADING_DAYS]
        if len(window) < TRADING_DAYS:
            continue
        ref = window[0].get("open") or window[0].get("close")
        if ref is None or ref == 0:
            continue
        highs = [b.get("high") for b in window if b.get("high") is not None]
        if not highs:
            continue
        max_high = max(highs)
        max_ret_pct = (max_high - ref) / ref * 100.0
        if max_ret_pct < THRESHOLD_PCT:
            continue
        best_bar = max(window, key=lambda b: (b.get("high") or 0, -window.index(b)))
        day_offset = window.index(best_bar)
        hits.append(
            {
                "article_idx": ev["article_idx"],
                "article_id": m.get("article_id"),
                "ticker": ticker,
                "published_at": ev["published_at"],
                "t0_kst": t0,
                "entry_a_t0_close_5m": round(px_a, 6),
                "ref_open": ref,
                "max_high": max_high,
                "max_return_pct": round(max_ret_pct, 4),
                "peak_trading_day_offset": day_offset,
                "peak_date": best_bar.get("date"),
                "window_dates": [b.get("date") for b in window],
                "eod_path": eod_rel,
            }
        )

    hits.sort(key=lambda x: (-(x["max_return_pct"] or 0), x.get("published_at") or ""))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "criteria": {
                    "cohort": "entry A (T0 장종 5분봉 종가) and hold 1 trading day exit price computable",
                    "cohort_count": cohort,
                    "anchor": "t0 daily open (first bar in 5-day window)",
                    "trading_days": TRADING_DAYS,
                    "min_peak_return_pct": THRESHOLD_PCT,
                    "peak_metric": "max(high) over window",
                },
                "count": len(hits),
                "rows": hits,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    tickers = sorted({r["ticker"] for r in hits})
    print(f"코호트(진입A·1일 청산 가능): {cohort}건")
    print(f"5거래일 내 고가 +{THRESHOLD_PCT}% 이상: {len(hits)}건, 서로 다른 티커 {len(tickers)}개")
    print(f"저장: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
