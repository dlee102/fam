#!/usr/bin/env python3
"""
Advanced News Impact Analysis - Price & Volume Focus (Sentiment Removed)

Metrics:
- Volume Ratio: Today's Volume / 5-day Avg Volume
- Gap %: (Open T - Close T-1) / Close T-1
- T0 Return: (Close T - Close T-1) / Close T-1
- Pre-Event Return: Return from T-5 to T-1

Strategies:
- Strategy A (Volume Spike): Volume Ratio >= 3.0
- Strategy B (Gap Momentum): Gap Up >= 2% AND Close > Open
- Strategy C (Oversold Reversal): Pre-Event Return < -5% AND T0 Return > 0%
- Strategy D (Healthy Reaction): 1.5 <= Volume Ratio < 3.0 AND 1% <= T0 Return < 5%
"""

import json
import sys
from pathlib import Path
from datetime import datetime, time, timedelta
import pandas as pd
import numpy as np

# Paths
BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "pharm_crawler" / "pharm_articles_manual_sentiment.json"

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded
STOCK_DIR = BASE / "ls_stock_1d"
TICKER_NAMES_PATH = BASE / "data" / "ticker_names.json"
OUTPUT_PATH = BASE / "data" / "advanced_stats.json"

MARKET_CLOSE_TIME = time(15, 0)

def load_json(path):
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

def get_trading_day_index(df: pd.DataFrame, target_date: pd.Timestamp) -> int | None:
    mask = df["date"] >= target_date
    if not mask.any():
        return None
    return int(df.index[mask.argmax()])

def calculate_metrics(df: pd.DataFrame, idx_t0: int):
    if idx_t0 < 5 or idx_t0 >= len(df):
        return None
    
    row_t0 = df.iloc[idx_t0]
    row_prev = df.iloc[idx_t0 - 1]
    row_t5_prev = df.iloc[idx_t0 - 5]
    
    # 1. Volume Ratio
    vol_t0 = float(row_t0["volume"])
    vol_avg_5d = df.iloc[idx_t0-5:idx_t0]["volume"].mean()
    vol_ratio = vol_t0 / vol_avg_5d if vol_avg_5d > 0 else 0.0

    # 2. Gap %
    close_prev = float(row_prev["close"])
    open_t0 = float(row_t0["open"])
    gap_pct = (open_t0 - close_prev) / close_prev if close_prev > 0 else 0.0

    # 3. T0 Return
    close_t0 = float(row_t0["close"])
    ret_t0 = (close_t0 - close_prev) / close_prev if close_prev > 0 else 0.0

    # 4. Pre-Event Return (T-5 to T-1)
    close_t5_prev = float(row_t5_prev["close"])
    pre_event_ret = (close_prev - close_t5_prev) / close_t5_prev if close_t5_prev > 0 else 0.0

    # 5. Intra-day movement
    is_close_higher = close_t0 > open_t0

    # 6. Future Returns (T+1, T+3, T+5, T+7, T+10) - entry_hold 권장 보유와 정렬
    future_rets = {}
    for h in [1, 3, 5, 7, 10]:
        if idx_t0 + h < len(df):
            close_future = float(df.iloc[idx_t0 + h]["close"])
            future_rets[h] = (close_future - close_t0) / close_t0
        else:
            future_rets[h] = None

    return {
        "vol_ratio": vol_ratio,
        "gap_pct": gap_pct,
        "ret_t0": ret_t0,
        "pre_event_ret": pre_event_ret,
        "is_close_higher": is_close_higher,
        "future_rets": future_rets,
        "date_t0": row_t0["date"].strftime("%Y-%m-%d")
    }

def run_analysis():
    articles = load_json(NEWS_PATH)
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
                except: pass
            
            target_date = pub_date + timedelta(days=1) if is_after_market else pub_date
        except: continue

        for ticker in tickers:
            if len(ticker) != 6 or not ticker.isdigit(): continue
            if is_excluded(ticker): continue
            df = load_stock_prices(ticker)
            if df is None: continue

            idx_t0 = get_trading_day_index(df, target_date)
            if idx_t0 is None: continue
            
            metrics = calculate_metrics(df, idx_t0)
            if not metrics: continue

            strategies = []
            # Strategy A: Volume Spike
            if metrics["vol_ratio"] >= 3.0:
                strategies.append("A")
            # Strategy B: Gap Momentum
            if metrics["gap_pct"] >= 0.02 and metrics["is_close_higher"]:
                strategies.append("B")
            # Strategy C: Oversold Reversal
            if metrics["pre_event_ret"] < -0.05 and metrics["ret_t0"] > 0:
                strategies.append("C")
            # Strategy D: Healthy Reaction
            if 1.5 <= metrics["vol_ratio"] < 3.0 and 0.01 <= metrics["ret_t0"] < 0.05:
                strategies.append("D")

            results.append({
                "ticker": ticker,
                "name": ticker_names.get(ticker, ticker),
                "news_id": art.get("newsId"),
                "title": art.get("title"),
                "vol_ratio": metrics["vol_ratio"],
                "gap_pct": metrics["gap_pct"],
                "ret_t0": metrics["ret_t0"],
                "pre_event_ret": metrics["pre_event_ret"],
                "strategies": strategies,
                "returns": metrics["future_rets"],
                "t0_date": metrics["date_t0"]
            })

    # Strategy Aggregation (기본 + 복합 전략)
    # 복합: 추천 = C 또는 D 이면서 A·B 없음 / 관망 = A 또는 B
    strategy_names = [
        "Baseline",
        "Strategy A", "Strategy B", "Strategy C", "Strategy D",
        "Strategy 추천",  # C or D, exclude A and B
        "Strategy 관망",  # A or B
    ]
    horizons = [1, 5, 7, 10]
    strategy_stats = {
        name: {
            "count": 0,
            **{f"wins_{h}d": 0 for h in horizons},
            **{f"sum_ret_{h}d": 0.0 for h in horizons},
            **{f"n_valid_{h}d": 0 for h in horizons},
        }
        for name in strategy_names
    }

    for res in results:
        strat = set(res["strategies"])
        has_a_or_b = "A" in strat or "B" in strat
        has_c_or_d = "C" in strat or "D" in strat

        # Baseline
        strategy_stats["Baseline"]["count"] += 1
        for h in horizons:
            r = res["returns"].get(h)
            if r is not None:
                strategy_stats["Baseline"][f"n_valid_{h}d"] += 1
                strategy_stats["Baseline"][f"sum_ret_{h}d"] += r
                if r > 0:
                    strategy_stats["Baseline"][f"wins_{h}d"] += 1

        # 개별 전략 A, B, C, D
        for s_code in res["strategies"]:
            name = f"Strategy {s_code}"
            strategy_stats[name]["count"] += 1
            for h in horizons:
                r = res["returns"].get(h)
                if r is not None:
                    strategy_stats[name][f"n_valid_{h}d"] += 1
                    strategy_stats[name][f"sum_ret_{h}d"] += r
                    if r > 0:
                        strategy_stats[name][f"wins_{h}d"] += 1

        # 복합: 추천 (C or D, no A, B)
        if has_c_or_d and not has_a_or_b:
            strategy_stats["Strategy 추천"]["count"] += 1
            for h in horizons:
                r = res["returns"].get(h)
                if r is not None:
                    strategy_stats["Strategy 추천"][f"n_valid_{h}d"] += 1
                    strategy_stats["Strategy 추천"][f"sum_ret_{h}d"] += r
                    if r > 0:
                        strategy_stats["Strategy 추천"][f"wins_{h}d"] += 1

        # 복합: 관망 (A or B)
        if has_a_or_b:
            strategy_stats["Strategy 관망"]["count"] += 1
            for h in horizons:
                r = res["returns"].get(h)
                if r is not None:
                    strategy_stats["Strategy 관망"][f"n_valid_{h}d"] += 1
                    strategy_stats["Strategy 관망"][f"sum_ret_{h}d"] += r
                    if r > 0:
                        strategy_stats["Strategy 관망"][f"wins_{h}d"] += 1

    final_strat_stats = []
    for name, s in strategy_stats.items():
        row = {"strategy": name, "count": s["count"]}
        for h in horizons:
            n = s[f"n_valid_{h}d"]
            row[f"win_rate_{h}d"] = s[f"wins_{h}d"] / n if n > 0 else 0
            row[f"avg_ret_{h}d"] = s[f"sum_ret_{h}d"] / n if n > 0 else 0
        final_strat_stats.append(row)

    # Sort results by date for strategy matches
    strategy_matches = [r for r in results if r["strategies"]]
    strategy_matches.sort(key=lambda x: x["t0_date"], reverse=True)

    # 시장 평균(669건) 심층분석: 상호배타 그룹별 구성·기여도
    no_pattern = []  # A,B,C,D 없음
    gwanmang = []   # A 또는 B (관망)
    chucheon = []   # C 또는 D 이면서 A·B 없음 (추천)
    for res in results:
        strat = set(res["strategies"])
        has_a_or_b = "A" in strat or "B" in strat
        has_c_or_d = "C" in strat or "D" in strat
        if has_a_or_b:
            gwanmang.append(res)
        elif has_c_or_d:
            chucheon.append(res)
        else:
            no_pattern.append(res)

    def agg_returns(group, horizons):
        n = len(group)
        if n == 0:
            return {"count": 0, **{f"avg_ret_{h}d": 0 for h in horizons}}
        out = {"count": n}
        for h in horizons:
            vals = [r["returns"].get(h) for r in group if r["returns"].get(h) is not None]
            out[f"avg_ret_{h}d"] = np.mean(vals) if vals else 0
        return out

    def contrib(count, avg_ret, total):
        return (count / total) * avg_ret * 100 if total > 0 else 0

    total_n = len(results)
    perf_map = {r["strategy"]: r for r in final_strat_stats}
    bl = perf_map["Baseline"]
    baseline_1d = bl.get("avg_ret_1d") or 0
    baseline_5d = bl.get("avg_ret_5d") or 0
    baseline_7d = bl.get("avg_ret_7d") or 0
    baseline_10d = bl.get("avg_ret_10d") or 0

    np_agg = agg_returns(no_pattern, horizons)
    gm_agg = agg_returns(gwanmang, horizons)
    cc_agg = agg_returns(chucheon, horizons)

    market_baseline_deep = {
        "total": total_n,
        "baseline_returns_pct": {
            "1d": round(baseline_1d * 100, 2),
            "5d": round(baseline_5d * 100, 2),
            "7d": round(baseline_7d * 100, 2),
            "10d": round(baseline_10d * 100, 2),
        },
        "groups": [
            {
                "label": "패턴 없음",
                "desc": "A·B·C·D 중 어느 것에도 해당하지 않음",
                "count": np_agg["count"],
                "pct_of_total": round(100 * np_agg["count"] / total_n, 1),
                "avg_ret_1d_pct": round(np_agg["avg_ret_1d"] * 100, 2),
                "avg_ret_5d_pct": round(np_agg["avg_ret_5d"] * 100, 2),
                "avg_ret_7d_pct": round(np_agg["avg_ret_7d"] * 100, 2),
                "avg_ret_10d_pct": round(np_agg["avg_ret_10d"] * 100, 2),
                "contrib_1d_pp": round(contrib(np_agg["count"], np_agg["avg_ret_1d"], total_n), 3),
                "contrib_5d_pp": round(contrib(np_agg["count"], np_agg["avg_ret_5d"], total_n), 3),
            },
            {
                "label": "관망 (A 또는 B)",
                "desc": "Volume Spike / Gap Momentum — 과열·급등 후 조정",
                "count": gm_agg["count"],
                "pct_of_total": round(100 * gm_agg["count"] / total_n, 1),
                "avg_ret_1d_pct": round(gm_agg["avg_ret_1d"] * 100, 2),
                "avg_ret_5d_pct": round(gm_agg["avg_ret_5d"] * 100, 2),
                "avg_ret_7d_pct": round(gm_agg["avg_ret_7d"] * 100, 2),
                "avg_ret_10d_pct": round(gm_agg["avg_ret_10d"] * 100, 2),
                "contrib_1d_pp": round(contrib(gm_agg["count"], gm_agg["avg_ret_1d"], total_n), 3),
                "contrib_5d_pp": round(contrib(gm_agg["count"], gm_agg["avg_ret_5d"], total_n), 3),
            },
            {
                "label": "추천 (C 또는 D, A·B 없음)",
                "desc": "Oversold Reversal / Healthy Reaction — 건전한 반등",
                "count": cc_agg["count"],
                "pct_of_total": round(100 * cc_agg["count"] / total_n, 1),
                "avg_ret_1d_pct": round(cc_agg["avg_ret_1d"] * 100, 2),
                "avg_ret_5d_pct": round(cc_agg["avg_ret_5d"] * 100, 2),
                "avg_ret_7d_pct": round(cc_agg["avg_ret_7d"] * 100, 2),
                "avg_ret_10d_pct": round(cc_agg["avg_ret_10d"] * 100, 2),
                "contrib_1d_pp": round(contrib(cc_agg["count"], cc_agg["avg_ret_1d"], total_n), 3),
                "contrib_5d_pp": round(contrib(cc_agg["count"], cc_agg["avg_ret_5d"], total_n), 3),
            },
        ],
        "insight": (
            "시장 평균 = (패턴 없음 × 비율) + (관망 × 비율) + (추천 × 비율). "
            "관망 구간이 1~5일 마이너스로 전체 평균을 끌어내리고, "
            "추천 구간이 플러스로 끌어올림. 패턴 없음 구간이 대부분을 차지."
        ),
    }

    output = {
        "generated_at": datetime.now().isoformat(),
        "strategy_performance": final_strat_stats,
        "market_baseline_deep": market_baseline_deep,
        "strategy_matches": strategy_matches[:100] # Return more matches now that sentiment is gone
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Analysis complete. Saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    run_analysis()
