#!/usr/bin/env python3
"""
유료 기사(기사×종목) 기준 진입 A~F × 보유 1~30거래일 그리드에서 승률 상위 조합.

`entry_hold_analysis.py`가 만든 `data/entry_hold_stats.json`의 detail을 읽는다.
데이터가 없거나 오래됐으면 먼저: `python3 scripts/entry_hold_analysis.py`

  python3 scripts/entry_hold_grid_search_winrate.py
  python3 scripts/entry_hold_grid_search_winrate.py --min-count 500 --top 20
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATS = ROOT / "data" / "entry_hold_stats.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-count", type=int, default=0, help="이 표본 수 이상만 (0=제한 없음)")
    parser.add_argument("--top", type=int, default=25, help="상위 몇 개")
    parser.add_argument(
        "--out",
        default="",
        help="JSON 저장 경로(기본: data/analysis/entry_hold_winrate_grid_top[_min{N}].json)",
    )
    args = parser.parse_args()

    if not STATS.is_file():
        print(f"없음: {STATS} — 먼저 python3 scripts/entry_hold_analysis.py", file=sys.stderr)
        sys.exit(1)

    data = json.loads(STATS.read_text(encoding="utf-8"))
    detail = data.get("detail")
    if not isinstance(detail, list) or not detail:
        print("detail 비어 있음", file=sys.stderr)
        sys.exit(1)

    rows = [r for r in detail if isinstance(r, dict) and r.get("count", 0) >= args.min_count]

    def sort_key(r: dict) -> tuple:
        wr = float(r.get("win_rate") or 0)
        n = int(r.get("count") or 0)
        return (-wr, -n)

    rows.sort(key=sort_key)
    top = rows[: args.top]

    out = {
        "source": str(STATS),
        "source_generated_at": data.get("generated_at"),
        "min_count": args.min_count,
        "top_n": args.top,
        "methodology_note": data.get("methodology_note"),
        "best_unfiltered": data.get("summary", {}).get("best_win_rate"),
        "ranked_by_win_rate": [
            {
                "rank": i + 1,
                "entry": r["entry"],
                "entry_label": r.get("entry_label"),
                "hold_days": r["hold_days"],
                "win_rate": round(r["win_rate"], 6),
                "win_rate_pct": round(r["win_rate"] * 100, 2),
                "avg_return_pct": round(r.get("avg_return", 0) * 100, 4),
                "count": r["count"],
            }
            for i, r in enumerate(top)
        ],
    }

    if args.out:
        out_path = Path(args.out)
    elif args.min_count > 0:
        out_path = ROOT / "data" / "analysis" / f"entry_hold_winrate_grid_top_min{args.min_count}.json"
    else:
        out_path = ROOT / "data" / "analysis" / "entry_hold_winrate_grid_top.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n저장: {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
