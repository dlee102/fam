"""Order book imbalance score: 호가 불균형 0~100."""

import pandas as pd

from quant.data import load_books


def compute_orderbook_imbalance_score(date: str) -> pd.DataFrame:
    """
    종목별 최신 호가 기준 bid/ask 총량 불균형 → 0~100 점수.
    imbalance = (bid_total - ask_total) / (bid_total + ask_total) → -1~1
    → 0~100로 변환 (높을수록 매수 우위)
    """
    df = load_books(date)
    bid_sz_cols = [f"bid_sz_{i}" for i in range(1, 11)]
    ask_sz_cols = [f"ask_sz_{i}" for i in range(1, 11)]

    # 마지막 시점(snapshot)만 사용
    last = df.groupby("symbol").tail(1).copy()
    last["bid_total"] = last[bid_sz_cols].sum(axis=1)
    last["ask_total"] = last[ask_sz_cols].sum(axis=1)

    total = last["bid_total"] + last["ask_total"]
    mask = total > 0
    last["imbalance"] = 0.0
    last.loc[mask, "imbalance"] = (
        (last.loc[mask, "bid_total"] - last.loc[mask, "ask_total"]) / total[mask]
    ).clip(-1, 1)
    # -1~1 → 0~100 (0.5 = 중립)
    last["score"] = ((last["imbalance"] + 1) / 2 * 100).round(1)

    return last[["symbol", "bid_total", "ask_total", "imbalance", "score"]].reset_index(drop=True)


def get_orderbook_score_for_symbol(date: str, symbol: str) -> float | None:
    """특정 종목의 호가 불균형 점수만 반환."""
    scores = compute_orderbook_imbalance_score(date)
    row = scores[scores["symbol"] == symbol]
    if row.empty:
        return None
    return float(row["score"].iloc[0])
