#!/usr/bin/env python3
"""
기사 출간 후 1d, 2d, 3d, 10d 보유 시 가장 많이 급등한 종목 리스트 + 성격 분석

- T0(반응일) 종가 기준 진입 → T+N 거래일 종가 수익률
- 각 기간별 상위 N개 급등 종목 추출
- 전략(A/B/C/D), 관망/추천/패턴없음, 기사유형 등 성격 분석
"""

import json
from pathlib import Path
from datetime import datetime, time, timedelta
from collections import defaultdict
import pandas as pd
import numpy as np

# Paths
BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "pharm_crawler" / "pharm_articles_manual_sentiment.json"
STOCK_DIR = BASE / "ls_stock_1d"
TICKER_NAMES_PATH = BASE / "data" / "ticker_names.json"
OUTPUT_PATH = BASE / "data" / "top_surge_analysis.json"

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded

MARKET_CLOSE_TIME = time(15, 0)
HORIZONS = [1, 2, 3, 10]
TOP_N = 30

# 기사 유형 키워드 (article_type_analysis와 동일)
TYPE_KEYWORDS = {
    "기술수출/계약": ["기술수출", "L/O", "라이선스 아웃", "공급계약", "협력", "파트너십"],
    "임상/데이터": ["임상", "1상", "2상", "3상", "결과", "데이터", "발표"],
    "허가/승인": ["허가", "승인", "신약", "FDA", "EMA", "식약처", "품목허가"],
    "학회/IR": ["학회", "JPM", "JP모건", "발표", "IR", "공개"],
    "실적/성장": ["실적", "흑자", "성장", "최대", "매출"],
    "상장/투자": ["상장", "IPO", "투자", "유치", "M&A", "인수"],
    "부정적/리스크": ["거절", "반려", "실패", "중단", "부작용", "논란"],
}


def load_json(path: Path):
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


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


def categorize_title(title: str) -> list[str]:
    found = []
    for cat, keywords in TYPE_KEYWORDS.items():
        if any(kw.lower() in title.lower() for kw in keywords):
            found.append(cat)
    return found if found else ["기타"]


def run_analysis():
    articles = load_json(NEWS_PATH)
    if not articles:
        print("No articles found")
        return

    ticker_names = load_json(TICKER_NAMES_PATH)
    results = []

    for art in articles:
        pub_date_str = art.get("published_date")
        pub_time_str = art.get("published_time")
        tickers = art.get("tickers", [])

        if not pub_date_str or not tickers:
            continue

        try:
            pub_date = pd.Timestamp(pub_date_str)
            is_after_market = True
            if pub_time_str:
                try:
                    h, m = map(int, pub_time_str.split(":"))
                    if time(h, m) <= MARKET_CLOSE_TIME:
                        is_after_market = False
                except Exception:
                    pass

            target_date = pub_date + timedelta(days=1) if is_after_market else pub_date
        except Exception:
            continue

        article_types = categorize_title(art.get("title", ""))

        for ticker in tickers:
            if len(ticker) != 6 or not ticker.isdigit():
                continue
            if is_excluded(ticker):
                continue
            df = load_stock_prices(ticker)
            if df is None:
                continue

            mask = df["date"] >= target_date
            if not mask.any():
                continue
            idx_t0 = int(df.index[mask.argmax()])

            if idx_t0 < 5 or idx_t0 >= len(df):
                continue

            row_t0 = df.iloc[idx_t0]
            row_prev = df.iloc[idx_t0 - 1]
            row_t5_prev = df.iloc[idx_t0 - 5]

            # Volume Ratio
            vol_t0 = float(row_t0["volume"])
            vol_avg_5d = df.iloc[idx_t0 - 5 : idx_t0]["volume"].mean()
            vol_ratio = vol_t0 / vol_avg_5d if vol_avg_5d > 0 else 0.0

            # Gap %
            close_prev = float(row_prev["close"])
            open_t0 = float(row_t0["open"])
            gap_pct = (open_t0 - close_prev) / close_prev if close_prev > 0 else 0.0

            # T0 Return
            close_t0 = float(row_t0["close"])
            ret_t0 = (close_t0 - close_prev) / close_prev if close_prev > 0 else 0.0

            # Pre-Event Return
            close_t5_prev = float(row_t5_prev["close"])
            pre_event_ret = (
                (close_prev - close_t5_prev) / close_t5_prev if close_t5_prev > 0 else 0.0
            )
            is_close_higher = close_t0 > open_t0

            # Future Returns (1, 2, 3, 10)
            future_rets = {}
            for h in HORIZONS:
                if idx_t0 + h < len(df):
                    close_future = float(df.iloc[idx_t0 + h]["close"])
                    future_rets[h] = (close_future - close_t0) / close_t0
                else:
                    future_rets[h] = None

            strategies = []
            if vol_ratio >= 3.0:
                strategies.append("A")
            if gap_pct >= 0.02 and is_close_higher:
                strategies.append("B")
            if pre_event_ret < -0.05 and ret_t0 > 0:
                strategies.append("C")
            if 1.5 <= vol_ratio < 3.0 and 0.01 <= ret_t0 < 0.05:
                strategies.append("D")

            has_a_or_b = "A" in strategies or "B" in strategies
            has_c_or_d = "C" in strategies or "D" in strategies
            if has_a_or_b:
                pattern_group = "관망"
            elif has_c_or_d:
                pattern_group = "추천"
            else:
                pattern_group = "패턴없음"

            results.append({
                "ticker": ticker,
                "name": ticker_names.get(ticker, ticker),
                "news_id": art.get("newsId"),
                "title": art.get("title", "")[:80],
                "vol_ratio": vol_ratio,
                "gap_pct": gap_pct,
                "ret_t0": ret_t0,
                "pre_event_ret": pre_event_ret,
                "strategies": strategies,
                "pattern_group": pattern_group,
                "article_types": article_types,
                "returns": future_rets,
                "t0_date": row_t0["date"].strftime("%Y-%m-%d"),
            })

    # --- 각 기간별 상위 N개 급등 종목 ---
    top_by_horizon = {}
    for h in HORIZONS:
        valid = [r for r in results if r["returns"].get(h) is not None]
        sorted_list = sorted(valid, key=lambda x: x["returns"][h], reverse=True)
        top_by_horizon[h] = [
            {
                "rank": i + 1,
                "ticker": r["ticker"],
                "name": r["name"],
                "title": r["title"],
                "ret_pct": round(r["returns"][h] * 100, 2),
                "ret_t0_pct": round(r["ret_t0"] * 100, 2),
                "vol_ratio": round(r["vol_ratio"], 2),
                "gap_pct": round(r["gap_pct"] * 100, 2),
                "strategies": r["strategies"],
                "pattern_group": r["pattern_group"],
                "article_types": r["article_types"],
                "t0_date": r["t0_date"],
            }
            for i, r in enumerate(sorted_list[:TOP_N])
        ]

    # --- 성격 분석: 각 기간 상위 N의 특성 분포 ---
    def analyze_characteristics(top_list: list) -> dict:
        n = len(top_list)
        if n == 0:
            return {}

        pattern_counts = defaultdict(int)
        strategy_counts = defaultdict(int)
        article_type_counts = defaultdict(int)
        vol_ratios = []
        gap_pcts = []
        ret_t0s = []

        for r in top_list:
            pattern_counts[r["pattern_group"]] += 1
            for s in r["strategies"]:
                strategy_counts[s] += 1
            for t in r["article_types"]:
                article_type_counts[t] += 1
            vol_ratios.append(r["vol_ratio"])
            gap_pcts.append(r["gap_pct"])
            ret_t0s.append(r["ret_t0_pct"])

        return {
            "count": n,
            "pattern_group": dict(pattern_counts),
            "strategies": dict(strategy_counts),
            "article_types": dict(article_type_counts),
            "avg_vol_ratio": round(np.mean(vol_ratios), 2),
            "avg_gap_pct": round(np.mean(gap_pcts), 2),
            "avg_ret_t0_pct": round(np.mean(ret_t0s), 2),
        }

    characteristics = {
        h: analyze_characteristics(top_by_horizon[h])
        for h in HORIZONS
    }

    # --- 기간별 최고 수익 1건씩 ---
    best_per_horizon = {}
    for h in HORIZONS:
        lst = top_by_horizon[h]
        if lst:
            best_per_horizon[h] = lst[0]

    output = {
        "generated_at": datetime.now().isoformat(),
        "horizons": HORIZONS,
        "top_n": TOP_N,
        "total_pairs": len(results),
        "top_by_horizon": top_by_horizon,
        "characteristics": characteristics,
        "best_per_horizon": best_per_horizon,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Saved to {OUTPUT_PATH}")
    return output


def print_report(data: dict):
    print("=" * 70)
    print("기사 출간 후 1d·2d·3d·10d 가장 많이 급등한 종목")
    print("=" * 70)
    print(f"총 (기사×종목) 쌍: {data['total_pairs']}")
    print()

    for h in data["horizons"]:
        top = data["top_by_horizon"][h]
        char = data["characteristics"][h]
        print(f"--- T+{h}일 상위 {len(top)}개 ---")
        if top:
            print(f"  #1: {top[0]['name']}({top[0]['ticker']}) {top[0]['ret_pct']:+.2f}% | {top[0]['title'][:50]}...")
        print(f"  성격: {char.get('pattern_group', {})}")
        print(f"  전략: {char.get('strategies', {})}")
        print(f"  기사유형: {char.get('article_types', {})}")
        print(f"  평균 vol_ratio={char.get('avg_vol_ratio')}, gap={char.get('avg_gap_pct')}%, ret_t0={char.get('avg_ret_t0_pct')}%")
        print()

    print("--- 기간별 1위 ---")
    for h, best in data["best_per_horizon"].items():
        print(f"  T+{h}d: {best['name']}({best['ticker']}) {best['ret_pct']:+.2f}% | {best['pattern_group']} | {best['strategies']}")


if __name__ == "__main__":
    out = run_analysis()
    if out:
        print_report(out)
