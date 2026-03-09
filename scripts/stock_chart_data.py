#!/usr/bin/env python3
"""
ls_stock_1d CSV → 일봉 OHLC JSON
발행일 기준 -10 ~ +10 거래일

Usage: python scripts/stock_chart_data.py 20260219 003090,011690,221800
"""

import json
import sys
from pathlib import Path

import pandas as pd

LS_STOCK_DIR = Path(__file__).resolve().parents[1] / "ls_stock_1d"


def load_daily(ticker: str) -> pd.DataFrame | None:
    """ls_stock_1d CSV 로드 (일봉)"""
    path = LS_STOCK_DIR / f"{ticker}_1d.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path)
    if df.empty or "date" not in df.columns:
        return None
    df["date"] = df["date"].astype(str)
    return df


def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: stock_chart_data.py YYYYMMDD ticker1,ticker2,..."}))
        sys.exit(1)

    center_date = sys.argv[1]
    tickers_raw = sys.argv[2]
    tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]

    # 6자리 숫자 티커만 (한국 주식)
    tickers = [t for t in tickers if t.isdigit() and len(t) == 6]

    center = pd.Timestamp(center_date)
    start = center - pd.Timedelta(days=14)
    end = center + pd.Timedelta(days=25)  # D+10 거래일 확보

    result: dict[str, list[dict]] = {}
    returns: dict[str, dict[str, float | None]] = {}

    for ticker in tickers:
        daily = load_daily(ticker)
        if daily is None:
            result[ticker] = []
            returns[ticker] = {"1d": None, "2d": None, "3d": None, "10d": None}
            continue
        daily["date_ts"] = pd.to_datetime(daily["date"])
        mask = (daily["date_ts"] >= start) & (daily["date_ts"] <= end)
        subset = daily[mask].sort_values("date").reset_index(drop=True)
        rows = []
        for _, r in subset.iterrows():
            rows.append({
                "date": r["date"],
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "volume": int(r["volume"]),
            })
        result[ticker] = rows

        # 발행일(D0) 기준 1d, 2d, 3d, 10d 수익률 (D0 = 발행일 또는 그 이후 최초 거래일)
        dates = subset["date"].tolist()
        candidates = [i for i, d in enumerate(dates) if d >= center_date]
        idx = min(candidates) if candidates else (len(dates) - 1)
        if idx < 0:
            returns[ticker] = {"1d": None, "2d": None, "3d": None, "10d": None}
            continue
        close0 = float(subset.iloc[idx]["close"])
        ret: dict[str, float | None] = {"1d": None, "2d": None, "3d": None, "10d": None}
        for n, key in [(1, "1d"), (2, "2d"), (3, "3d"), (10, "10d")]:
            if idx + n < len(dates):
                close_n = float(subset.iloc[idx + n]["close"])
                ret[key] = round((close_n - close0) / close0 * 100, 2)
        returns[ticker] = ret

    print(json.dumps({"center_date": center_date, "data": result, "returns": returns}, ensure_ascii=False))


if __name__ == "__main__":
    main()
