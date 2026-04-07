#!/usr/bin/env python3
"""
발행일(t0) 시가 기준, 같은 날 포함 연속 5거래일 안에 고가가 +10% 이상인 기사·종목 추출.

- 기준가: t0 일봉 open (장 개장 전 뉴스 발행 가정과 정합)
- 구간: t0, t0+1, … t0+4 (총 5거래일) 중 일봉 high 최댓값
- 조건: (max_high - ref) / ref * 100 >= threshold_pct
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/eodhd_news_windows/per_article/manifest_per_article.json"
EOD_BASE = ROOT / "data/eodhd_news_windows"
OUT_DEFAULT = ROOT / "data/analysis/publish_5d_high_ge_10pct.json"
TRADING_DAYS = 5
THRESHOLD_PCT = 10.0


def find_t0_index(bars: list[dict], t0_kst: str) -> int:
    for i, b in enumerate(bars):
        if b.get("date", "") >= t0_kst:
            return i
    return -1


def main() -> int:
    if not MANIFEST.is_file():
        print(f"manifest not found: {MANIFEST}", file=sys.stderr)
        return 1

    rows = json.loads(MANIFEST.read_text(encoding="utf-8"))
    hits: list[dict] = []

    for r in rows:
        if not r.get("eod_ok"):
            continue
        rel = r.get("eod_path")
        if not rel:
            continue
        path = EOD_BASE / rel
        if not path.is_file():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        bars = payload.get("bars") or []
        t0 = payload.get("t0_kst") or r.get("t0_kst")
        if not bars or not t0:
            continue
        idx = find_t0_index(bars, t0)
        if idx < 0:
            continue
        window = bars[idx : idx + TRADING_DAYS]
        if not window:
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
        # 어느 거래일에 고가가 max에 가까웠는지 (동률이면 가장 이른 날)
        best_bar = max(window, key=lambda b: (b.get("high") or 0, -window.index(b)))
        day_offset = window.index(best_bar)
        hits.append(
            {
                "article_idx": r.get("article_idx"),
                "article_id": r.get("article_id"),
                "ticker": r.get("ticker"),
                "published_at": r.get("published_at"),
                "t0_kst": t0,
                "ref_open": ref,
                "max_high": max_high,
                "max_return_pct": round(max_ret_pct, 4),
                "peak_trading_day_offset": day_offset,
                "peak_date": best_bar.get("date"),
                "window_dates": [b.get("date") for b in window],
                "eod_path": rel,
            }
        )

    hits.sort(key=lambda x: (-(x["max_return_pct"] or 0), x.get("published_at") or ""))

    OUT_DEFAULT.parent.mkdir(parents=True, exist_ok=True)
    OUT_DEFAULT.write_text(
        json.dumps(
            {
                "criteria": {
                    "anchor": "t0 daily open",
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

    print(f"조건: t0 시가 기준 {TRADING_DAYS}거래일 내 고가 최대 수익률 >= {THRESHOLD_PCT}%")
    print(f"매칭: {len(hits)}건 (전체 매니페스트 {len(rows)}건 중 eod_ok만 스캔)")
    print(f"저장: {OUT_DEFAULT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
