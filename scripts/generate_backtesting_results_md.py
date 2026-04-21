#!/usr/bin/env python3
"""
Quant V2 홀딩 그리드 백테스트 JSON → 통합 Markdown 리포트.

입력 (있는 파일만 포함):
  data/analysis/quant_v2_hold_grid_backtest_{all|test}_{5m_F|eod}.json

출력:
  data/analysis/backtesting_results.md

선행:
  python3 scripts/quant_v2_hold_grid_backtest.py --universe all
  python3 scripts/quant_v2_hold_grid_backtest.py --universe test
  (필요 시 --basis eod)
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "analysis"
OUT_MD = OUT_DIR / "backtesting_results.md"

REPORTS: list[tuple[str, str]] = [
    ("all", "5m_F", "전체 유니버스 · 5분봉 진입 F"),
    ("test", "5m_F", "시간 분할 테스트(뒤 30%) · 5분봉 F"),
    ("all", "eod", "전체 유니버스 · 일봉 종가"),
    ("test", "eod", "시간 분할 테스트 · 일봉 종가"),
]

HOLDS_SHOW = [1, 3, 5, 10, 20]
MIN_SCORES_SHOW = [0, 60, 70, 80]


def load_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def section_for_report(universe: str, tag: str, title: str) -> str | None:
    path = OUT_DIR / f"quant_v2_hold_grid_backtest_{universe}_{tag}.json"
    data = load_json(path)
    if not data:
        return None
    meta = data.get("meta") or {}
    grid = data.get("grid") or {}

    lines = [
        f"### {title}",
        "",
        f"- **소스:** `{path.relative_to(ROOT)}`",
        f"- **이벤트 수:** {meta.get('n_events_with_returns', '—')}",
        f"- **홀딩 범위:** {meta.get('hold_range', '—')}",
        f"- **수익 정의:** {meta.get('return_definition', '—')}",
        "",
    ]

    for ms in MIN_SCORES_SHOW:
        key = f"min_score_{ms}"
        if key not in grid:
            continue
        lines.append(f"#### 최소 점수 ≥ {ms}")
        lines.append("")
        lines.append("| 홀딩(거래일) | n | 승률% | 평균% | 중앙% |")
        lines.append("|-------------|---|-------|-------|-------|")
        g = grid[key]
        for h in HOLDS_SHOW:
            hs = str(h)
            if hs not in g:
                continue
            c = g[hs]
            lines.append(
                f"| {h} | {c.get('n', 0)} | {c.get('win_rate_pct', 0)} | "
                f"{c.get('avg_ret_pct', 0)} | {c.get('median_ret_pct', 0)} |"
            )
        lines.append("")

    qu = data.get("quintiles_by_score") or []
    if qu:
        lines.append("#### 점수 분위 × 홀딩 (평균%)")
        lines.append("")
        lines.append("| 분위 | n | 점수 | hold5 | hold10 | hold20 |")
        lines.append("|------|---|------|-------|--------|--------|")
        for row in qu:
            s5 = (row.get("hold_5d") or {}).get("avg_ret_pct", "—")
            s10 = (row.get("hold_10d") or {}).get("avg_ret_pct", "—")
            s20 = (row.get("hold_20d") or {}).get("avg_ret_pct", "—")
            lines.append(
                f"| Q{row.get('quintile')} | {row.get('n')} | "
                f"{row.get('score_min')}–{row.get('score_max')} | {s5} | {s10} | {s20} |"
            )
        lines.append("")

    detail_md = path.with_suffix(".md")
    if detail_md.is_file():
        lines.append(f"전체 그리드: `{detail_md.relative_to(ROOT)}`")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    chunks: list[str] = [
        "# 백테스팅 결과 요약 (Quant V2 홀딩 그리드)",
        "",
        f"생성 시각: **{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}** (로컬)",
        "",
        "## 점수 정의",
        "",
        "- 웹과 동일: 양전 로지스틱 점수(0~99) × `(1 − 폭락위험점수/100)`",
        "- `test` 유니버스는 시간순 **뒤 30%**만 사용 (학습 표본과 겹치지 않게 보려는 용도).",
        "",
        "## 갱신 방법",
        "",
        "```bash",
        "python3 scripts/quant_v2_hold_grid_backtest.py --universe all",
        "python3 scripts/quant_v2_hold_grid_backtest.py --universe test",
        "python3 scripts/quant_v2_hold_grid_backtest.py --universe all --basis eod",
        "python3 scripts/quant_v2_hold_grid_backtest.py --universe test --basis eod",
        "python3 scripts/generate_backtesting_results_md.py",
        "```",
        "",
    ]

    any_ok = False
    for universe, tag, title in REPORTS:
        block = section_for_report(universe, tag, title)
        if block:
            chunks.append(block)
            chunks.append("---")
            chunks.append("")
            any_ok = True

    if not any_ok:
        chunks.append(
            "_집계할 JSON이 없습니다. 위 명령으로 `quant_v2_hold_grid_backtest_*.json`을 먼저 생성하세요._"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(chunks).rstrip() + "\n", encoding="utf-8")
    print(f"저장: {OUT_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
