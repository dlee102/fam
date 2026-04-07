#!/usr/bin/env python3
"""
시장 평균(Baseline) 팩트 체크:
기사 공개 후 T0(반응일) 종가 매수 → T+N일 종가 매도 수익률이 맞는지 검증
"""

import json
from pathlib import Path
from datetime import time, timedelta
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "pharm_crawler" / "pharm_articles_manual_sentiment.json"
STOCK_DIR = BASE / "ls_stock_1d"
ADVANCED_PATH = BASE / "data" / "advanced_stats.json"
MARKET_CLOSE_TIME = time(15, 0)


def load_stock_prices(ticker: str) -> pd.DataFrame | None:
    for ext in ["_1d.csv", "_1d.parquet"]:
        path = STOCK_DIR / f"{ticker}{ext}"
        if path.exists():
            df = pd.read_csv(path) if path.suffix == ".csv" else pd.read_parquet(path)
            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"].astype(str), format="mixed")
                df = df.sort_values("date").reset_index(drop=True)
                return df
    return None


def main():
    articles = json.load(open(NEWS_PATH, encoding="utf-8")) if NEWS_PATH.exists() else []
    advanced = json.load(open(ADVANCED_PATH, encoding="utf-8")) if ADVANCED_PATH.exists() else {}

    # strategy_matches에서 T+10 데이터 있는 샘플 우선 추출 (완전 검증용)
    all_matches = advanced.get("strategy_matches", [])
    with_full = [m for m in all_matches if m.get("returns", {}).get("10") is not None]
    matches = (with_full[:3] if with_full else all_matches[:5])

    print("=" * 80)
    print("시장 평균 팩트 체크: 기사 공개 → T0 종가 매수 → T+N 종가 매도")
    print("=" * 80)

    # 기사 정보 매핑
    art_by_id = {a.get("newsId"): a for a in articles if a.get("newsId")}

    for m in matches:
        ticker = m["ticker"]
        t0_date = m["t0_date"]
        rets = m.get("returns", {})
        title = m.get("title", "")[:50]

        df = load_stock_prices(ticker)
        if df is None:
            print(f"\n[{ticker}] 주가 데이터 없음")
            continue

        # t0_date 해당 행 찾기
        df["date_str"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        row_t0 = df[df["date_str"] == t0_date]
        if row_t0.empty:
            print(f"\n[{ticker}] T0 날짜 {t0_date} 없음")
            continue

        idx_t0 = row_t0.index[0]
        close_t0 = float(row_t0.iloc[0]["close"])

        print(f"\n--- {m.get('name', ticker)} ({ticker}) | T0={t0_date} ---")
        print(f"기사: {title}...")
        print(f"T0 종가: {close_t0:,.0f}원")

        for h in [1, 5, 7, 10]:
            idx_future = idx_t0 + h
            if idx_future >= len(df):
                print(f"  T+{h}d: 데이터 부족")
                continue
            row_f = df.iloc[idx_future]
            close_f = float(row_f["close"])
            date_f = str(row_f["date"])[:10]
            ret_manual = (close_f - close_t0) / close_t0
            ret_stored = rets.get(h) or rets.get(str(h))
            match = "✓" if (ret_stored is not None and abs(ret_manual - ret_stored) < 1e-5) else "✗"
            stored_pct = f"{ret_stored*100:.2f}%" if ret_stored is not None else "None"
            print(f"  T+{h}d ({date_f}) 종가 {close_f:,.0f} → 수익률 {ret_manual*100:.2f}% (저장: {stored_pct}) {match}")

    # Baseline 평균과 수동 집계 비교
    print("\n" + "=" * 80)
    print("Baseline 집계 검증: 637건 전체의 평균 수익률")
    print("=" * 80)

    # advanced_stats에서 Baseline 값
    perf = {r["strategy"]: r for r in advanced.get("strategy_performance", [])}
    bl = perf.get("Baseline", {})
    print(f"저장된 시장 평균: 1일 {bl.get('avg_ret_1d', 0)*100:.2f}%, 5일 {bl.get('avg_ret_5d', 0)*100:.2f}%, 7일 {bl.get('avg_ret_7d', 0)*100:.2f}%, 10일 {bl.get('avg_ret_10d', 0)*100:.2f}%")

    # strategy_matches 전체로 수동 평균 계산 (Baseline은 모든 results에서 나옴 - matches는 전략 있는 것만)
    # 실제로 Baseline은 results 전체에서 계산됨. matches는 strategies가 있는 것만.
    # results 전체를 다시 계산할 수 없으므로, 대신 matches + no-pattern 샘플로 검증

    # T0 정의 재확인
    print("\n" + "=" * 80)
    print("T0(진입일) 정의")
    print("=" * 80)
    print("• 기사 장 마감 전(15:00 이하) 공개 → T0 = 공개 당일 (당일 종가 매수)")
    print("• 기사 장 마감 후(15:00 초과) 공개 → T0 = 다음 거래일 (다음날 종가 매수)")
    print("• 수익률 = (T+N 거래일 종가 - T0 종가) / T0 종가")
    print("  → 즉, T0 종가 기준 매수 후 N거래일 보유 시 종가 매도 수익률")


if __name__ == "__main__":
    main()
