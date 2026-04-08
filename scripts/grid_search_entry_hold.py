#!/usr/bin/env python3
"""
`data/publish_horizon_curve.json` 기준 진입(A~F) × 보유 거래일(N) 그리드 서치.

목표:
- 평균 수익률(avg_return_pct) 최대
- 손익비 PF = avg_pos / |avg_neg| (가능할 때)
- 표본 n 필터(min_n) 적용 시 상위 조합

출력: data/analysis/entry_hold_grid_search.json + entry_hold_grid_search.md
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURVE = ROOT / "data" / "publish_horizon_curve.json"
OUT_DIR = ROOT / "data" / "analysis"
OUT_JSON = OUT_DIR / "entry_hold_grid_search.json"
OUT_MD = OUT_DIR / "entry_hold_grid_search.md"


@dataclass
class Cell:
    entry: str
    label: str
    hold: int
    avg_ret: float
    win_rate: float
    n: int
    pf: float | None

    def profit_factor(self) -> float | None:
        return self.pf


def pf_from_point(p: dict) -> float | None:
    ap = p.get("avg_pos_return_pct")
    an = p.get("avg_neg_return_pct")
    np_ = p.get("n_pos")
    nn = p.get("n_neg")
    if ap is None or an is None or an >= 0 or not np_ or not nn:
        return None
    return abs(float(ap) / float(an))


def main() -> int:
    if not CURVE.is_file():
        print("missing", CURVE, file=sys.stderr)
        return 1

    raw = json.loads(CURVE.read_text(encoding="utf-8"))
    entries = raw.get("entries") or {}
    cells: list[Cell] = []

    for code, block in entries.items():
        label = block.get("label") or code
        for p in block.get("points") or []:
            day = int(p["trading_day"])
            cells.append(
                Cell(
                    entry=code,
                    label=label,
                    hold=day,
                    avg_ret=float(p["avg_return_pct"]),
                    win_rate=float(p["win_rate"]),
                    n=int(p["count"]),
                    pf=pf_from_point(p),
                )
            )

    def sort_key_avg(c: Cell) -> tuple:
        return (c.avg_ret, c.win_rate, c.n)

    def sort_key_pf(c: Cell) -> tuple:
        pf = c.pf if c.pf is not None else -1.0
        return (pf, c.avg_ret, c.n)

    # 복합 스코어: 평균수익 × 승률 (단순 기대치 근사, % 단위 아님)
    def sort_key_combo(c: Cell) -> float:
        return c.avg_ret * c.win_rate

    by_avg = sorted(cells, key=sort_key_avg, reverse=True)
    by_pf = sorted([c for c in cells if c.pf is not None], key=sort_key_pf, reverse=True)
    by_combo = sorted(cells, key=sort_key_combo, reverse=True)

    min_ns = [500, 800, 1000, 1200]

    def top_filtered(
        seq: list[Cell], pred, k: int = 20
    ) -> list[Cell]:
        return [c for c in seq if pred(c)][:k]

    payload = {
        "source": str(CURVE.relative_to(ROOT)),
        "generated_at_curve": raw.get("generated_at"),
        "n_combinations": len(cells),
        "top_by_avg_return_pct": [
            {
                "entry": c.entry,
                "hold_trading_days": c.hold,
                "label": c.label,
                "avg_return_pct": round(c.avg_ret, 4),
                "win_rate": round(c.win_rate, 6),
                "n": c.n,
                "profit_factor": round(c.pf, 4) if c.pf is not None else None,
            }
            for c in by_avg[:30]
        ],
        "top_by_profit_factor": [
            {
                "entry": c.entry,
                "hold_trading_days": c.hold,
                "label": c.label,
                "avg_return_pct": round(c.avg_ret, 4),
                "win_rate": round(c.win_rate, 6),
                "n": c.n,
                "profit_factor": round(c.pf, 4) if c.pf is not None else None,
            }
            for c in by_pf[:30]
        ],
        "top_by_avg_times_winrate": [
            {
                "entry": c.entry,
                "hold_trading_days": c.hold,
                "label": c.label,
                "avg_return_pct": round(c.avg_ret, 4),
                "win_rate": round(c.win_rate, 6),
                "n": c.n,
                "score_avg_x_wr": round(sort_key_combo(c), 6),
            }
            for c in by_combo[:30]
        ],
        "best_under_min_n": {},
    }

    for mn in min_ns:
        sub = sorted(
            [c for c in cells if c.n >= mn],
            key=sort_key_avg,
            reverse=True,
        )[:15]
        payload["best_under_min_n"][str(mn)] = [
            {
                "entry": c.entry,
                "hold_trading_days": c.hold,
                "label": c.label,
                "avg_return_pct": round(c.avg_ret, 4),
                "win_rate": round(c.win_rate, 4),
                "n": c.n,
                "profit_factor": round(c.pf, 4) if c.pf is not None else None,
            }
            for c in sub
        ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Markdown
    lines: list[str] = []
    lines.append("# 진입 × 보유 거래일 그리드 서치 결과\n")
    lines.append(f"- **데이터:** `{payload['source']}`\n")
    lines.append(f"- **집계 시각(곡선):** {payload.get('generated_at_curve')}\n")
    lines.append(f"- **조합 수:** {payload['n_combinations']}\n")
    lines.append("\n## 1. 평균 수익률 상위 20 (전체 그리드)\n")
    lines.append("| 순위 | 진입 | N일 | 평균수익% | 승률 | n | PF |\n")
    lines.append("| ---: | :--- | ---: | ---: | ---: | ---: | ---: |\n")
    for i, c in enumerate(by_avg[:20], 1):
        pf_s = f"{c.pf:.3f}" if c.pf is not None else "—"
        lines.append(
            f"| {i} | {c.entry} | {c.hold} | {c.avg_ret:.4f} | {c.win_rate*100:.2f}% | {c.n} | {pf_s} |\n"
        )

    lines.append("\n## 2. 손익비(PF) 상위 15 (PF 정의 가능한 조합만)\n")
    lines.append("| 순위 | 진입 | N일 | PF | 평균수익% | 승률 | n |\n")
    lines.append("| ---: | :--- | ---: | ---: | ---: | ---: | ---: |\n")
    for i, c in enumerate(by_pf[:15], 1):
        lines.append(
            f"| {i} | {c.entry} | {c.hold} | {c.pf:.3f} | {c.avg_ret:.4f} | {c.win_rate*100:.2f}% | {c.n} |\n"
        )

    lines.append("\n## 3. 표본 크기 하한 적용 — 평균 수익률 1위 조합\n")
    for mn in min_ns:
        sub = sorted([c for c in cells if c.n >= mn], key=sort_key_avg, reverse=True)
        best = sub[0] if sub else None
        if best:
            pf_s = f"{best.pf:.3f}" if best.pf is not None else "—"
            lines.append(
                f"- **n ≥ {mn}:** `{best.entry}` · **{best.hold}거래일** — "
                f"평균 **{best.avg_ret:.4f}%**, 승률 {best.win_rate*100:.2f}%, n={best.n}, PF={pf_s}\n"
            )

    lines.append("\n## 4. Entry A · Hold 1 기준점\n")
    a1 = next((c for c in cells if c.entry == "A" and c.hold == 1), None)
    if a1:
        rank_avg = 1 + sum(1 for c in cells if sort_key_avg(c) > sort_key_avg(a1))
        pf_s = f"{a1.pf:.3f}" if a1.pf is not None else "—"
        lines.append(
            f"- **A, 1일:** 평균 {a1.avg_ret:.4f}%, 승률 {a1.win_rate*100:.2f}%, n={a1.n}, PF={pf_s}\n"
        )
        lines.append(f"- **평균수익 기준 순위:** 전체 {len(cells)}개 중 약 **{rank_avg}위** (동순위 단순 비교)\n")

    lines.append("\n---\n*생성: `python3 scripts/grid_search_entry_hold.py`*\n")
    OUT_MD.write_text("".join(lines), encoding="utf-8")

    print("Wrote", OUT_JSON)
    print("Wrote", OUT_MD)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
