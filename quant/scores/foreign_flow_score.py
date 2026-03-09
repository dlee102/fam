"""Foreign net flow score: 외국인 순매수 강도 0~100."""

import pandas as pd

from quant.data import load_foreign_flow


def compute_foreign_flow_score(date: str) -> pd.DataFrame:
    """
    일별 외국인 순매수(금액) 합계 → 0~100 점수 (percentile rank).
    Returns: DataFrame with columns [symbol, foreign_net_sum, score]
    """
    df = load_foreign_flow(date)
    agg = df.groupby("symbol", as_index=False).agg(
        foreign_net_sum=("foreign_net", "sum"),
        foreign_net_qty_sum=("foreign_net_qty", "sum"),
    )
    # Percentile rank: 0~100, higher net buy = higher score
    agg["score"] = agg["foreign_net_sum"].rank(pct=True, method="average") * 100
    agg["score"] = agg["score"].round(1)
    return agg[["symbol", "foreign_net_sum", "foreign_net_qty_sum", "score"]]


def get_foreign_flow_score_for_symbol(date: str, symbol: str) -> float | None:
    """특정 종목의 외국인 수급 점수만 반환."""
    scores = compute_foreign_flow_score(date)
    row = scores[scores["symbol"] == symbol]
    if row.empty:
        return None
    return float(row["score"].iloc[0])
