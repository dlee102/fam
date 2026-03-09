#!/usr/bin/env python3
"""
Quant score CLI: 모든 점수 계산 후 JSON 출력.

Usage:
  python -m quant.run 20240102
  python -m quant.run 20240102 --symbol KR7000020008
"""

import argparse
import json
import sys
from pathlib import Path

# Ensure quant is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from quant.scores import (
    compute_foreign_flow_score,
    compute_volume_score,
    compute_orderbook_imbalance_score,
    compute_momentum_score,
    compute_trend_score,
    compute_spread_score,
    get_foreign_flow_score_for_symbol,
    get_volume_score_for_symbol,
    get_orderbook_score_for_symbol,
    get_momentum_score_for_symbol,
    get_trend_score_for_symbol,
    get_spread_score_for_symbol,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute quant scores for a date")
    parser.add_argument("date", help="Date YYYYMMDD")
    parser.add_argument("--symbol", "-s", help="Single symbol (ISIN) to get scores for")
    parser.add_argument("--format", "-f", choices=["json", "table"], default="json")
    args = parser.parse_args()

    date = args.date
    if len(date) != 8 or not date.isdigit():
        print("Error: date must be YYYYMMDD", file=sys.stderr)
        sys.exit(1)

    try:
        if args.symbol:
            # Single symbol
            ff = get_foreign_flow_score_for_symbol(date, args.symbol)
            vol = get_volume_score_for_symbol(date, args.symbol)
            ob = get_orderbook_score_for_symbol(date, args.symbol)
            mom = get_momentum_score_for_symbol(date, args.symbol)
            trend = get_trend_score_for_symbol(date, args.symbol)
            spread = get_spread_score_for_symbol(date, args.symbol)
            ff_df = compute_foreign_flow_score(date)
            row = ff_df[ff_df["symbol"] == args.symbol]
            foreign_net_millions = (
                round(float(row["foreign_net_sum"].iloc[0]) / 1_000_000)
                if not row.empty
                else None
            )
            out = {
                "date": date,
                "symbol": args.symbol,
                "scores": {
                    "foreign_flow": ff,
                    "volume": vol,
                    "orderbook_imbalance": ob,
                    "momentum": mom,
                    "trend": trend,
                    "spread": spread,
                },
                "foreign_net_millions": foreign_net_millions,
            }
        else:
            # All symbols
            ff_df = compute_foreign_flow_score(date)
            vol_df = compute_volume_score(date)
            ob_df = compute_orderbook_imbalance_score(date)
            mom_df = compute_momentum_score(date)
            trend_df = compute_trend_score(date)
            spread_df = compute_spread_score(date)
            out = {
                "date": date,
                "foreign_flow": ff_df.to_dict(orient="records"),
                "volume": vol_df.to_dict(orient="records"),
                "orderbook_imbalance": ob_df.to_dict(orient="records"),
                "momentum": mom_df.to_dict(orient="records"),
                "trend": trend_df.to_dict(orient="records"),
                "spread": spread_df.to_dict(orient="records"),
            }

        if args.format == "json":
            print(json.dumps(out, ensure_ascii=False, indent=2))
        elif not args.symbol:
            for name, df in [
                ("foreign_flow", ff_df),
                ("volume", vol_df),
                ("orderbook", ob_df),
                ("momentum", mom_df),
                ("trend", trend_df),
                ("spread", spread_df),
            ]:
                print(f"\n=== {name} ===")
                print(df.head(15).to_string())

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
