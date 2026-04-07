#!/usr/bin/env python3
"""
기사 공개 이후 양전(상승) 종목 클러스터링 분석

- news_tickers.json의 기사별 published_date, tickers 사용
- ls_stock_1d/*.csv 일봉 데이터로 T+1, T+3, T+5 수익률 계산
- 종목별 양전률(positive rate) 산출 후 클러스터링
"""

import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

import pandas as pd
import numpy as np

# Paths
BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "data" / "news_tickers.json"
STOCK_DIR = BASE / "ls_stock_1d"
TICKER_NAMES_PATH = BASE / "data" / "ticker_names.json"

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded


def load_ticker_names() -> dict[str, str]:
    """종목코드 → 종목명 매핑"""
    if TICKER_NAMES_PATH.exists():
        with open(TICKER_NAMES_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def load_stock_prices(ticker: str) -> pd.DataFrame | None:
    """종목 일봉 로드. date를 datetime으로 변환."""
    for ext in ["_1d.csv", "_1d.parquet"]:
        path = STOCK_DIR / f"{ticker}{ext}"
        if path.exists():
            if path.suffix == ".csv":
                df = pd.read_csv(path)
            else:
                df = pd.read_parquet(path)
            df["date"] = pd.to_datetime(df["date"].astype(str), format="mixed")
            df = df.sort_values("date").reset_index(drop=True)
            return df
    return None


def get_close_on_or_after(df: pd.DataFrame, target_date: str) -> tuple[float | None, int | None]:
    """
    target_date(YYYY-MM-DD) 당일 또는 그 이후 첫 거래일의 close 반환.
    Returns (close_price, row_index) or (None, None) if not found.
    """
    target = pd.Timestamp(target_date)
    mask = df["date"] >= target
    if not mask.any():
        return None, None
    idx = mask.idxmax()
    row = df.loc[idx]
    return float(row["close"]), int(df.index.get_loc(idx))


def compute_returns(
    df: pd.DataFrame,
    base_idx: int,
    horizons: list[int],
) -> dict[int, float | None]:
    """base_idx 기준 T+N 거래일 수익률. None이면 데이터 부족."""
    base_close = df.iloc[base_idx]["close"]
    out = {}
    for h in horizons:
        next_idx = base_idx + h
        if next_idx >= len(df):
            out[h] = None
            continue
        next_close = df.iloc[next_idx]["close"]
        out[h] = (next_close - base_close) / base_close
    return out


def is_valid_ticker(t: str) -> bool:
    """주가 데이터가 있는 종목만 (6자리 숫자 또는 해외 심볼)"""
    if not t or t in ("비상장", "Platform", "K-Bio", "AimedBio", "ImmuneOncia", "NEUROPHET"):
        return False
    path_csv = STOCK_DIR / f"{t}_1d.csv"
    path_pq = STOCK_DIR / f"{t}_1d.parquet"
    return path_csv.exists() or path_pq.exists()


def run_analysis(horizons: list[int] = [1, 3, 5]):
    """메인 분석 실행"""
    with open(NEWS_PATH, encoding="utf-8") as f:
        data = json.load(f)

    articles = data.get("articles", [])
    ticker_names = load_ticker_names()

    # (ticker, horizon) -> [return, return, ...]
    returns_by_ticker: dict[str, dict[int, list[float]]] = defaultdict(
        lambda: {h: [] for h in horizons}
    )

    total_pairs = 0
    skipped_no_data = 0
    skipped_no_future = 0

    for art in articles:
        pub_date = art.get("published_date")
        tickers = art.get("tickers", [])
        if not pub_date or not tickers:
            continue

        for ticker in tickers:
            if not is_valid_ticker(ticker):
                continue
            if is_excluded(ticker):
                continue

            df = load_stock_prices(ticker)
            if df is None or len(df) == 0:
                skipped_no_data += 1
                continue

            close_t0, idx = get_close_on_or_after(df, pub_date)
            if close_t0 is None or idx is None:
                skipped_no_data += 1
                continue

            rets = compute_returns(df, idx, horizons)
            for h in horizons:
                r = rets.get(h)
                if r is not None:
                    returns_by_ticker[ticker][h].append(r)
                    total_pairs += 1
                else:
                    skipped_no_future += 1

    # 종목별 양전률 계산
    rows = []
    for ticker, rets_by_h in returns_by_ticker.items():
        row = {"ticker": ticker, "name": ticker_names.get(ticker, ticker)}
        for h in horizons:
            arr = np.array(rets_by_h[h])
            if len(arr) == 0:
                row[f"count_{h}d"] = 0
                row[f"positive_rate_{h}d"] = np.nan
                row[f"avg_return_{h}d"] = np.nan
            else:
                row[f"count_{h}d"] = len(arr)
                row[f"positive_rate_{h}d"] = (arr > 0).mean()
                row[f"avg_return_{h}d"] = arr.mean()
        rows.append(row)

    df_result = pd.DataFrame(rows)

    # 클러스터: 양전률 기준 3분위 (상/중/하)
    for h in horizons:
        col = f"positive_rate_{h}d"
        if col in df_result.columns and df_result[col].notna().any():
            q33 = df_result[col].quantile(0.33)
            q67 = df_result[col].quantile(0.67)
            def cluster(v):
                if pd.isna(v):
                    return "N/A"
                if v <= q33:
                    return "하"
                if v <= q67:
                    return "중"
                return "상"
            df_result[f"cluster_{h}d"] = df_result[col].apply(cluster)

    # 최소 기사 수 필터 (노이즈 제거) — 5건 미만은 양전률 추정치가 너무 불안정
    min_count = 5
    df_filtered = df_result[df_result["count_1d"] >= min_count].copy()

    return df_result, df_filtered, {
        "total_articles": len(articles),
        "total_pairs_analyzed": total_pairs,
        "skipped_no_data": skipped_no_data,
        "skipped_no_future": skipped_no_future,
        "min_count_filter": min_count,
    }


def print_report(df_all: pd.DataFrame, df_filtered: pd.DataFrame, stats: dict):
    """결과 출력"""
    print("=" * 70)
    print("기사 공개 이후 양전(상승) 종목 클러스터링")
    print("⚠ 주의: T0 종가 진입 가정이며, 당일 장중 공개 시각을 반영하지 않습니다.")
    print("⚠ 클러스터는 동일 표본 내 상대 분위 기준이며, 미래 수익을 보장하지 않습니다.")
    print("=" * 70)
    print(f"총 기사 수: {stats['total_articles']}")
    print(f"분석된 (기사×종목×기간) 쌍: {stats['total_pairs_analyzed']}")
    print(f"데이터 부족 스킵: {stats['skipped_no_data']}, 미래 데이터 부족: {stats['skipped_no_future']}")
    print()

    horizons = [1, 3, 5]
    mc = stats.get("min_count_filter", 5)
    for h in horizons:
        col = f"positive_rate_{h}d"
        if col not in df_filtered.columns:
            continue
        valid = df_filtered[col].dropna()
        if len(valid) == 0:
            continue
        print(f"--- T+{h} 거래일 양전률 (기사 {mc}건 이상 종목) ---")
        top = df_filtered.nlargest(15, col)[["ticker", "name", f"count_{h}d", col, f"avg_return_{h}d"]]
        top[col] = top[col].apply(lambda x: f"{x:.1%}" if pd.notna(x) else "-")
        top[f"avg_return_{h}d"] = top[f"avg_return_{h}d"].apply(lambda x: f"{x:.2%}" if pd.notna(x) else "-")
        print(top.to_string(index=False))
        print()

    print("--- 클러스터 분포 (T+1일 양전률 기준) ---")
    if "cluster_1d" in df_filtered.columns:
        dist = df_filtered["cluster_1d"].value_counts()
        for k, v in dist.items():
            print(f"  {k}: {v}개 종목")
    print()

    print("--- 상위 클러스터(양전률 상) 종목 목록 ---")
    if "cluster_1d" in df_filtered.columns:
        top_cluster = df_filtered[df_filtered["cluster_1d"] == "상"].sort_values(
            "positive_rate_1d", ascending=False
        )
        cols = ["ticker", "name", "count_1d", "positive_rate_1d", "positive_rate_3d", "positive_rate_5d"]
        cols = [c for c in cols if c in top_cluster.columns]
        sub = top_cluster[cols].head(20)
        for c in ["positive_rate_1d", "positive_rate_3d", "positive_rate_5d"]:
            if c in sub.columns:
                sub[c] = sub[c].apply(lambda x: f"{x:.1%}" if pd.notna(x) else "-")
        print(sub.to_string(index=False))


def main():
    df_all, df_filtered, stats = run_analysis()
    print_report(df_all, df_filtered, stats)

    out_path = BASE / "data" / "post_publish_positive_clustering.csv"
    df_filtered.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"\n결과 저장: {out_path}")

    # JSON (웹 페이지용)
    json_path = BASE / "data" / "post_publish_positive_clustering.json"
    def to_serializable(obj):
        if isinstance(obj, (np.integer, np.int64)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64)):
            return float(obj) if not np.isnan(obj) else None
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return obj

    cluster_dist = df_filtered["cluster_1d"].value_counts().to_dict() if "cluster_1d" in df_filtered.columns else {}
    cluster_dist = {str(k): int(v) for k, v in cluster_dist.items()}

    top_df = df_filtered.nlargest(25, "positive_rate_1d")[
        ["ticker", "name", "count_1d", "positive_rate_1d", "avg_return_1d", "positive_rate_3d", "positive_rate_5d", "cluster_1d"]
    ]
    top_records = []
    for _, r in top_df.iterrows():
        top_records.append({
            "ticker": str(r["ticker"]),
            "name": str(r["name"]),
            "count_1d": int(r["count_1d"]) if pd.notna(r["count_1d"]) else 0,
            "positive_rate_1d": to_serializable(r["positive_rate_1d"]),
            "avg_return_1d": to_serializable(r["avg_return_1d"]),
            "positive_rate_3d": to_serializable(r["positive_rate_3d"]),
            "positive_rate_5d": to_serializable(r["positive_rate_5d"]),
            "cluster_1d": str(r["cluster_1d"]) if pd.notna(r["cluster_1d"]) else None,
        })

    payload = {
        "generated_at": datetime.now().isoformat(),
        "stats": stats,
        "cluster_distribution": cluster_dist,
        "top_positive": top_records,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"JSON 저장: {json_path}")


if __name__ == "__main__":
    main()
