#!/usr/bin/env python3
"""
기사 유형별(Keywords) 주가 반응 분석
"""

import json
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

# Paths
BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "data" / "news_tickers.json"
STOCK_DIR = BASE / "ls_stock_1d"
OUTPUT_PATH = BASE / "data" / "article_type_stats.json"

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded

# 기사 유형 정의 (키워드 기반)
TYPE_KEYWORDS = {
    "기술수출/계약": ["기술수출", "L/O", "라이선스 아웃", "공급계약", "협력", "파트너십"],
    "임상/데이터": ["임상", "1상", "2상", "3상", "결과", "데이터", "발표"],
    "허가/승인": ["허가", "승인", "신약", "FDA", "EMA", "식약처", "품목허가"],
    "학회/IR": ["학회", "JPM", "JP모건", "발표", "IR", "공개"],
    "실적/성장": ["실적", "흑자", "성장", "최대", "매출"],
    "상장/투자": ["상장", "IPO", "투자", "유치", "M&A", "인수"],
    "부정적/리스크": ["거절", "반려", "실패", "중단", "부작용", "논란"]
}

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

def categorize_title(title: str):
    found = []
    for cat, keywords in TYPE_KEYWORDS.items():
        if any(kw.lower() in title.lower() for kw in keywords):
            found.append(cat)
    return found if found else ["기타"]

def main():
    with open(NEWS_PATH, encoding="utf-8") as f:
        news_data = json.load(f)

    results = []
    
    # Cache for stock data to avoid repeated reads
    stock_cache = {}

    for article in news_data["articles"]:
        title = article["title"]
        tickers = article["tickers"]
        pub_date = pd.to_datetime(article["published_date"])
        
        categories = categorize_title(title)
        
        for ticker in tickers:
            if is_excluded(ticker):
                continue
            if ticker not in stock_cache:
                stock_cache[ticker] = load_stock_prices(ticker)
            
            df = stock_cache[ticker]
            if df is None:
                continue
                
            mask = df["date"] >= pub_date
            if not mask.any():
                continue
                
            idx_t0 = mask.idxmax()
            row_prev = df.iloc[idx_t0 - 1] if idx_t0 > 0 else None
            row_t0 = df.iloc[idx_t0]
            
            if row_prev is None:
                continue
                
            close_prev = row_prev["close"]
            close_t0 = row_t0["close"]
            ret_t0 = (close_t0 - close_prev) / close_prev
            
            future_rets = {}
            for h in [1, 3, 5]:
                if idx_t0 + h < len(df):
                    close_h = df.iloc[idx_t0 + h]["close"]
                    future_rets[h] = (close_h - close_t0) / close_t0
                else:
                    future_rets[h] = None
            
            for cat in categories:
                results.append({
                    "category": cat,
                    "ret_t0": ret_t0,
                    "ret_t1": future_rets[1],
                    "ret_t5": future_rets[5]
                })

    df_res = pd.DataFrame(results)
    
    summary = []
    for cat, group in df_res.groupby("category"):
        summary.append({
            "type": cat,
            "count": len(group),
            "avg_ret_t0": group["ret_t0"].mean(),
            "avg_ret_t1": group["ret_t1"].mean(),
            "avg_ret_t5": group["ret_t5"].mean(),
            "win_rate_t0": (group["ret_t0"] > 0).mean(),
            "win_rate_t1": (group["ret_t1"] > 0).mean(),
            "win_rate_t5": (group["ret_t5"] > 0).mean()
        })

    # Sort by avg_ret_t0
    summary = sorted(summary, key=lambda x: x["avg_ret_t0"], reverse=True)

    output = {
        "generated_at": datetime.now().isoformat(),
        "summary": summary
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"Article type analysis complete. Saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
