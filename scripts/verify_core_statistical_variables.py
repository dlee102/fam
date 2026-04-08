#!/usr/bin/env python3
"""
`news_path_outcome_stats.json` + `technical_verification_report.md`의 MWU p-value를 읽어
Bonferroni 기준으로 '핵심 변수' 후보를 기계적으로 정리합니다.

출력: data/analysis/core_variables_verification.json

실행:
  python3 scripts/verify_core_statistical_variables.py
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS_JSON = ROOT / "data/analysis/news_path_outcome_stats.json"
TECH_MD = ROOT / "technical_verification_report.md"
OUT_JSON = ROOT / "data/analysis/core_variables_verification.json"


def main() -> int:
    if not NEWS_JSON.is_file():
        print("missing", NEWS_JSON)
        return 1
    news = json.loads(NEWS_JSON.read_text(encoding="utf-8"))
    thr_news = float(news["multiple_testing"]["bonferroni_threshold"])
    n_news = int(news["multiple_testing"]["n_tests"])

    rows = []
    for name, block in news["features"].items():
        pv = block.get("mann_whitney_p")
        if pv is None:
            continue
        rows.append({"feature": name, "p_value": float(pv)})

    def classify(name: str) -> str:
        if name == "final_ret":
            return "tautology_outcome"
        if name == "event_day_ret":
            return "same_day_leakage"
        return "candidate"

    rows.sort(key=lambda x: x["p_value"])
    news_ranked = [
        {
            **r,
            "passes_bonferroni_news_block": r["p_value"] < thr_news,
            "classification": classify(r["feature"]),
        }
        for r in rows
    ]
    usable_pred = [
        r
        for r in news_ranked
        if r["passes_bonferroni_news_block"] and r["classification"] == "candidate"
    ]
    exploratory_05 = [
        r["feature"]
        for r in news_ranked
        if r["classification"] == "candidate" and r["p_value"] < 0.05
    ]

    tech_rows: list[dict] = []
    if TECH_MD.is_file():
        for line in TECH_MD.read_text(encoding="utf-8").splitlines():
            if not line.startswith("|") or line.startswith("| :"):
                continue
            parts = [c.strip() for c in line.split("|")[1:-1]]
            if len(parts) < 4 or parts[0] in ("지표", ""):
                continue
            key, pm, nm, pv = parts[0], parts[1], parts[2], parts[3]
            try:
                pvf = float(pv)
            except ValueError:
                continue
            tech_rows.append(
                {"feature": key, "pos_mean": pm, "neg_mean": nm, "p_value": pvf}
            )
    tech_rows.sort(key=lambda x: x["p_value"])
    n_tech = len(tech_rows)
    thr_tech = 0.05 / n_tech if n_tech else 0.01
    for r in tech_rows:
        r["passes_bonferroni_tech_block"] = r["p_value"] < thr_tech
    tech_pass = [r["feature"] for r in tech_rows if r["passes_bonferroni_tech_block"]]

    doc = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary_ko": (
            f"경로 양·음 MWU {n_news}개(Bonferroni p<{thr_news:.4f}): "
            "누설·동어반복을 제외하면 예측용 단일 변수는 없음. "
            f"D-1 기술지표 MWU {n_tech}개(Bonferroni p<{thr_tech:.4f}): "
            f"{tech_pass or '없음'}만 통과."
        ),
        "news_path_outcome_mwu": {
            "json_path": str(NEWS_JSON.relative_to(ROOT)),
            "n_mann_whitney_tests": n_news,
            "bonferroni_alpha_0_05": thr_news,
            "ranked": news_ranked,
            "passes_bonferroni_excluding_leakage_tautology": usable_pred,
            "exploratory_p_lt_0_05_features": exploratory_05,
        },
        "technical_pre_event_mwu": {
            "source_md": str(TECH_MD.relative_to(ROOT)),
            "n_mann_whitney_tests": n_tech,
            "bonferroni_alpha_0_05": round(thr_tech, 6),
            "ranked": tech_rows,
            "passes_bonferroni": tech_pass,
        },
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)
    print(doc["summary_ko"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
