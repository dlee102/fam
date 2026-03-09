#!/usr/bin/env python3
"""
입장 시점 & 보유 기간별 승률/수익률 분석

질문: 뉴스 나온 후 언제 들어가고, 얼마나 홀딩해야 수익 승률이 가장 높은가?

Entry (입장):
- A: T=0 종가 (뉴스 반응일 종가 매수)
- B: T+1 시가 (다음 거래일 시가 매수)
- C: T+1 종가 (다음 거래일 종가 매수, pullback)

Hold (보유): 1, 2, 3, 4, 5, 7, 10 거래일
"""

import json
from pathlib import Path
from datetime import datetime, time, timedelta
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "data" / "news_tickers.json"
STOCK_DIR = BASE / "ls_stock_1d"
OUTPUT_PATH = BASE / "data" / "entry_hold_stats.json"

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded

MARKET_CLOSE_TIME = time(15, 0)

def load_json(path):
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}

def load_stock_prices(ticker: str) -> pd.DataFrame | None:
    for ext in ["_1d.csv", "_1d.parquet"]:
        p = STOCK_DIR / f"{ticker}{ext}"
        if p.exists():
            df = pd.read_csv(p) if p.suffix == ".csv" else pd.read_parquet(p)
            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"].astype(str), format="mixed")
                df = df.sort_values("date").reset_index(drop=True)
                return df
    return None

def get_t0_idx(df: pd.DataFrame, target_date: pd.Timestamp) -> int | None:
    mask = df["date"] >= target_date
    if not mask.any():
        return None
    return int(df.index[mask.argmax()])

def is_valid_ticker(t: str) -> bool:
    if not t or len(t) != 6 or not t.isdigit():
        return False
    return (STOCK_DIR / f"{t}_1d.csv").exists() or (STOCK_DIR / f"{t}_1d.parquet").exists()

def run():
    data = load_json(NEWS_PATH)
    articles = data.get("articles", [])
    
    # (entry, hold) -> list of returns
    returns_by_combo = {}
    for entry in ["A", "B", "C"]:
        for hold in [1, 2, 3, 4, 5, 7, 10]:
            returns_by_combo[(entry, hold)] = []
    
    for art in articles:
        pub = art.get("published_date")
        tickers = art.get("tickers", [])
        if not pub or not tickers:
            continue
        target = pd.Timestamp(pub)  # T=0 = 퍼블 당일 또는 그 다음 거래일
        
        for ticker in tickers:
            if not is_valid_ticker(ticker):
                continue
            if is_excluded(ticker):
                continue
            df = load_stock_prices(ticker)
            if df is None:
                continue
            idx = get_t0_idx(df, target)
            if idx is None or idx + 10 >= len(df):
                continue
            
            # Entry A: T=0 close
            entry_a = float(df.iloc[idx]["close"])
            if entry_a > 0:
                for h in [1, 2, 3, 4, 5, 7, 10]:
                    if idx + h < len(df):
                        sell = float(df.iloc[idx + h]["close"])
                        ret = (sell - entry_a) / entry_a
                        returns_by_combo[("A", h)].append(ret)
            
            # Entry B: T+1 open
            if idx + 1 < len(df):
                entry_b = float(df.iloc[idx + 1]["open"])
                if entry_b > 0:
                    for h in [1, 2, 3, 4, 5, 7, 10]:
                        sell_idx = idx + 1 + h
                        if sell_idx < len(df):
                            sell = float(df.iloc[sell_idx]["close"])
                            ret = (sell - entry_b) / entry_b
                            returns_by_combo[("B", h)].append(ret)
            
            # Entry C: T+1 close
            if idx + 2 < len(df):
                entry_c = float(df.iloc[idx + 1]["close"])
                if entry_c > 0:
                    for h in [1, 2, 3, 4, 5, 7, 10]:
                        sell_idx = idx + 1 + h
                        if sell_idx < len(df):
                            sell = float(df.iloc[sell_idx]["close"])
                            ret = (sell - entry_c) / entry_c
                            returns_by_combo[("C", h)].append(ret)
    
    # Aggregate
    entry_labels = {"A": "T=0 종가 (반응일)", "B": "T+1 시가 (다음날)", "C": "T+1 종가 (다음날)"}
    rows = []
    for (entry, hold), rets in returns_by_combo.items():
        if not rets:
            continue
        arr = [r for r in rets if r is not None]
        if not arr:
            continue
        wins = sum(1 for r in arr if r > 0)
        rows.append({
            "entry": entry,
            "entry_label": entry_labels[entry],
            "hold_days": hold,
            "count": len(arr),
            "win_rate": wins / len(arr),
            "avg_return": sum(arr) / len(arr)
        })
    
    # Best combo by win rate
    best_wr = max(rows, key=lambda x: x["win_rate"])
    best_ret = max(rows, key=lambda x: x["avg_return"])
    
    out = {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "best_win_rate": {
                "entry": best_wr["entry"],
                "entry_label": best_wr["entry_label"],
                "hold_days": best_wr["hold_days"],
                "win_rate": best_wr["win_rate"],
                "avg_return": best_wr["avg_return"],
                "count": best_wr["count"]
            },
            "best_avg_return": {
                "entry": best_ret["entry"],
                "entry_label": best_ret["entry_label"],
                "hold_days": best_ret["hold_days"],
                "win_rate": best_ret["win_rate"],
                "avg_return": best_ret["avg_return"],
                "count": best_ret["count"]
            }
        },
        "detail": rows
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to {OUTPUT_PATH}")
    print(f"Best Win Rate: {best_wr['entry_label']} 입장, {best_wr['hold_days']}일 홀딩 -> 승률 {best_wr['win_rate']:.1%}")
    print(f"Best Avg Return: {best_ret['entry_label']} 입장, {best_ret['hold_days']}일 홀딩 -> 평균 {best_ret['avg_return']:.2%}")

if __name__ == "__main__":
    run()
