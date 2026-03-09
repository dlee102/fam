"""Spread score: 호가 스프레드 (유동성) 0~100."""

import pandas as pd

from quant.data import load_books


def compute_spread_score(date: str) -> pd.DataFrame:
    """
    종목별 1호가 스프레드: (ask_px_1 - bid_px_1) / mid.
    스프레드가 좁을수록 유동성 좋음 → 높은 점수.
    score = 100 - percentile(spread_pct)
    """
    df = load_books(date)
    last = df.groupby("symbol").tail(1).copy()

    last["mid"] = (last["bid_px_1"] + last["ask_px_1"]) / 2
    last["spread"] = last["ask_px_1"] - last["bid_px_1"]
    last["spread_pct"] = last["spread"] / last["mid"].replace(0, pd.NA)

    valid = last.dropna(subset=["spread_pct"])
    if valid.empty:
        return pd.DataFrame(columns=["symbol", "spread", "spread_pct", "score"])

    valid = valid.copy()
    # 낮은 스프레드 = 높은 점수 → 역 percentile
    valid["score"] = (1 - valid["spread_pct"].rank(pct=True, method="average")) * 100
    valid["score"] = valid["score"].round(1)
    # NaN인 종목은 50 (중립)
    result = last[["symbol", "spread", "spread_pct"]].merge(
        valid[["symbol", "score"]], on="symbol", how="left"
    )
    result["score"] = result["score"].fillna(50).round(1)

    return result[["symbol", "spread", "spread_pct", "score"]]


def get_spread_score_for_symbol(date: str, symbol: str) -> float | None:
    """특정 종목의 스프레드 점수만 반환."""
    scores = compute_spread_score(date)
    row = scores[scores["symbol"] == symbol]
    if row.empty:
        return None
    return float(row["score"].iloc[0])
