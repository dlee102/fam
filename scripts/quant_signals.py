#!/usr/bin/env python3
"""
기사별 퀀트 매매 신호 생성
news_tickers.json + ls_stock_1d → data/quant_signals.json

전략 (advanced_analysis와 동일):
- A: Volume Spike (거래량 3배+) → 관망
- B: Gap Momentum (갭상승 2%+ 양봉) → 관망
- C: Oversold Reversal (직전 5일 -5%+ 하락 후 양봉) → 추가 매수
- D: Healthy Reaction (거래량 1.5~3배, 주가 1~5% 상승) → 추가 매수

Output: { "newsId": { "ticker": { "signal": "추가 매수"|"관망"|"중립", "strategy": "C: Oversold Reversal" } } }
"""

import json
import re
from pathlib import Path
from datetime import timedelta

import pandas as pd

BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "data" / "news_tickers.json"
STOCK_DIR = BASE / "ls_stock_1d"
OUTPUT_PATH = BASE / "data" / "quant_signals.json"


def load_stock_prices(ticker: str) -> pd.DataFrame | None:
    for ext in ["_1d.csv", "_1d.parquet"]:
        path = STOCK_DIR / f"{ticker}{ext}"
        if path.exists():
            if path.suffix == ".csv":
                df = pd.read_csv(path)
            else:
                df = pd.read_parquet(path)
            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"].astype(str), format="mixed")
                df = df.sort_values("date").reset_index(drop=True)
                return df
    return None


def get_trading_day_index(df: pd.DataFrame, target_date: pd.Timestamp) -> int | None:
    mask = df["date"] >= target_date
    if not mask.any():
        return None
    return int(df.index[mask.argmax()])


def calculate_metrics(df: pd.DataFrame, idx_t0: int) -> dict | None:
    if idx_t0 < 5 or idx_t0 >= len(df):
        return None

    row_t0 = df.iloc[idx_t0]
    row_prev = df.iloc[idx_t0 - 1]
    row_t5_prev = df.iloc[idx_t0 - 5]

    vol_t0 = float(row_t0["volume"])
    vol_avg_5d = df.iloc[idx_t0 - 5 : idx_t0]["volume"].mean()
    vol_ratio = vol_t0 / vol_avg_5d if vol_avg_5d > 0 else 0.0

    close_prev = float(row_prev["close"])
    open_t0 = float(row_t0["open"])
    gap_pct = (open_t0 - close_prev) / close_prev if close_prev > 0 else 0.0

    close_t0 = float(row_t0["close"])
    ret_t0 = (close_t0 - close_prev) / close_prev if close_prev > 0 else 0.0

    close_t5_prev = float(row_t5_prev["close"])
    pre_event_ret = (close_prev - close_t5_prev) / close_t5_prev if close_t5_prev > 0 else 0.0

    is_close_higher = close_t0 > open_t0

    return {
        "vol_ratio": vol_ratio,
        "gap_pct": gap_pct,
        "ret_t0": ret_t0,
        "pre_event_ret": pre_event_ret,
        "is_close_higher": is_close_higher,
    }


STRATEGY_LABELS = {
    "A": "Volume Spike(거래량 3배+)",
    "B": "Gap Momentum(갭상승 2%+)",
    "C": "Oversold Reversal(과매도 반등)",
    "D": "Healthy Reaction(건강한 반응)",
}


def run():
    if not NEWS_PATH.exists():
        print(f"Not found: {NEWS_PATH}")
        return

    data = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    articles = data.get("articles", [])

    signals_by_article: dict[str, dict[str, dict]] = {}

    for art in articles:
        news_id = art.get("newsId")
        pub_date_str = art.get("published_date")
        tickers = art.get("tickers", [])

        if not news_id or not pub_date_str or not tickers:
            continue

        try:
            pub_date = pd.Timestamp(pub_date_str)
            target_date = pub_date + timedelta(days=1)
        except Exception:
            continue

        ticker_signals: dict[str, dict] = {}

        for ticker in tickers:
            if len(ticker) != 6 or not ticker.isdigit():
                continue

            df = load_stock_prices(ticker)
            if df is None:
                continue

            idx_t0 = get_trading_day_index(df, target_date)
            if idx_t0 is None:
                continue

            metrics = calculate_metrics(df, idx_t0)
            if not metrics:
                continue

            strategies = []
            if metrics["vol_ratio"] >= 3.0:
                strategies.append("A")
            if metrics["gap_pct"] >= 0.02 and metrics["is_close_higher"]:
                strategies.append("B")
            if metrics["pre_event_ret"] < -0.05 and metrics["ret_t0"] > 0:
                strategies.append("C")
            if 1.5 <= metrics["vol_ratio"] < 3.0 and 0.01 <= metrics["ret_t0"] < 0.05:
                strategies.append("D")

            has_good = "C" in strategies or "D" in strategies
            has_bad = "A" in strategies or "B" in strategies

            if has_good and not has_bad:
                signal = "추가 매수"
                strategy_label = ", ".join(STRATEGY_LABELS[s] for s in strategies if s in ("C", "D"))
            elif has_bad:
                signal = "관망"
                strategy_label = ", ".join(STRATEGY_LABELS[s] for s in strategies if s in ("A", "B"))
            else:
                signal = "중립"
                strategy_label = ""

            ticker_signals[ticker] = {"signal": signal, "strategy": strategy_label or ""}

        if ticker_signals:
            signals_by_article[news_id] = ticker_signals

    output = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "signals": signals_by_article,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(signals_by_article)} articles → {OUTPUT_PATH}")


if __name__ == "__main__":
    run()
