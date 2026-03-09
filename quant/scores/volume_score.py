"""Volume/Activity score: 거래량 기반 활성도 0~100."""

import pandas as pd

from quant.data import load_trades


def compute_volume_score(date: str) -> pd.DataFrame:
    """
    종목별 누적거래량(cum_volume 최대값) → 0~100 점수 (percentile rank).
    Returns: DataFrame with columns [symbol, total_volume, score]
    """
    df = load_trades(date)
    agg = df.groupby("symbol", as_index=False).agg(
        total_volume=("cum_volume", "max"),
        trade_count=("ts_ms", "count"),
    )
    agg["score"] = agg["total_volume"].rank(pct=True, method="average") * 100
    agg["score"] = agg["score"].round(1)
    return agg[["symbol", "total_volume", "trade_count", "score"]]


def get_volume_score_for_symbol(date: str, symbol: str) -> float | None:
    """특정 종목의 거래량 점수만 반환."""
    scores = compute_volume_score(date)
    row = scores[scores["symbol"] == symbol]
    if row.empty:
        return None
    return float(row["score"].iloc[0])
