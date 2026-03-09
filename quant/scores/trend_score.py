"""Trend score: 일중 추세 강도 0~100."""

import pandas as pd

from quant.data import load_trades


def compute_trend_score(date: str) -> pd.DataFrame:
    """
    종목별 일중 추세: (고가 - 저가) / 시가 = 변동폭 대비 움직임.
    상승 추세일수록 (종가 > 시가) 가중치 부여.
    score = 50 + 50 * (종가-시가)/(고가-저가) when range>0, else 50
    → 0~100, 50=횡보, 100=강한 상승, 0=강한 하락
    """
    df = load_trades(date)
    last = df.groupby("symbol").last().reset_index()

    last["range"] = last["high_px"] - last["low_px"]
    last["direction"] = last["trade_px"] - last["open_px"]
    # range가 0이면 중립 50
    mask = last["range"] > 0
    last["trend_ratio"] = 0.5
    last.loc[mask, "trend_ratio"] = (
        last.loc[mask, "direction"] / last.loc[mask, "range"]
    ).clip(-1, 1)
    # -1~1 → 0~100
    last["score"] = ((last["trend_ratio"] + 1) / 2 * 100).round(1)

    return last[["symbol", "open_px", "trade_px", "high_px", "low_px", "range", "trend_ratio", "score"]]


def get_trend_score_for_symbol(date: str, symbol: str) -> float | None:
    """특정 종목의 추세 점수만 반환."""
    scores = compute_trend_score(date)
    row = scores[scores["symbol"] == symbol]
    if row.empty:
        return None
    return float(row["score"].iloc[0])
