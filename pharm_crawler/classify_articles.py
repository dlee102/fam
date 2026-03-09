#!/usr/bin/env python3
"""
전체 기사 분류 - 제목·본문 직접 읽고 유형 할당
"""

import json
import re
from pathlib import Path

INPUT = Path(__file__).parent / "pharm_articles_with_tickers.json"
OUTPUT = Path(__file__).parent / "pharm_articles_classified.json"

# 분류 기준 (우선순위 적용)
def classify(art: dict) -> str:
    t = (art.get("title") or "")
    b = (art.get("body") or "")

    if not b or art.get("premium_blocked"):
        return "프리미엄_차단"

    # 1. 시리즈 태그 (제목 괄호)
    if "[바이오맥짚기]" in t:
        return "바이오맥짚기"
    if "[K-Bio Pulse]" in t or "[K-bio pulse]" in t:
        return "K-Bio_Pulse"
    if "대해부" in t and "[" in t:
        return "기업_대해부"
    if "[전문가 인사이트]" in t:
        return "전문가_인사이트"
    if "[2026 유망바이오" in t or "[바이오 VC" in t or "집중조명" in t:
        return "시리즈_기획"

    # 2. 본문 리드 패턴
    lead = b[:500]
    if "국내 제약·바이오주식시장" in lead or "제약·바이오주식시장" in lead:
        return "시장_라운드업"
    if "국내 증시에서 제약·바이오" in lead:
        return "시장_라운드업"

    # 3. 영문 기사 (리포터 영문 = K-Bio Pulse)
    if "[NA " in b or "[Kim " in b or "[Yu " in b or "[Shin-" in b:
        return "K-Bio_Pulse"

    # 4. 대표 인터뷰 (대표 + 인용문)
    if "대표" in t and ("\"" in t or '"' in t or '"' in t) and "대해부" not in t:
        return "대표_인터뷰"

    # 5. 산업·트렌드 (업종 분석)
    if "현황은?" in t or "기업은?" in t or "퇴출" in t:
        return "산업_트렌드"
    if "시장 주류" in t or "시장의 판도" in b[:300]:
        return "산업_트렌드"

    # 6. 단일 기업 (회사명, 주제)
    return "단일_기업"


def main():
    with open(INPUT, encoding="utf-8") as f:
        arts = json.load(f)

    counts = {}
    for i, a in enumerate(arts):
        cluster = classify(a)
        a["cluster"] = cluster
        counts[cluster] = counts.get(cluster, 0) + 1

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(arts, f, ensure_ascii=False, indent=2)

    print("분류 완료")
    for k in sorted(counts.keys(), key=lambda x: -counts[x]):
        print(f"  {k}: {counts[k]}")
    print(f"\n저장: {OUTPUT}")


if __name__ == "__main__":
    main()
