"""Momentum score: 일중 수익률 0~100."""

import pandas as pd

from quant.data import load_trades


def compute_momentum_score(date: str) -> pd.DataFrame:
    """
    종목별 일중 수익률 (마지막가 - 시가) / 시가 → 0~100 percentile.
    상승 종목일수록 높은 점수.
    """
    df = load_trades(date)
    first = df.groupby("symbol").first().reset_index()
    last = df.groupby("symbol").last().reset_index()

    merged = first[["symbol", "open_px"]].merge(last[["symbol", "trade_px"]], on="symbol")
    merged["return_pct"] = (merged["trade_px"] - merged["open_px"]) / merged["open_px"].replace(0, pd.NA)
    merged["return_pct"] = merged["return_pct"].fillna(0)
    merged["score"] = merged["return_pct"].rank(pct=True, method="average") * 100
    merged["score"] = merged["score"].round(1)

    return merged[["symbol", "open_px", "trade_px", "return_pct", "score"]]


def get_momentum_score_for_symbol(date: str, symbol: str) -> float | None:
    """특정 종목의 모멘텀 점수만 반환."""
    scores = compute_momentum_score(date)
    row = scores[scores["symbol"] == symbol]
    if row.empty:
        return None
    return float(row["score"].iloc[0])
