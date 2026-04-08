#!/usr/bin/env python3
"""
publish_5d_high_ge_10pct_entry_a_hold1_cohort.json(진입A·1일 코호트 1350, 그중 5일 +10% 히트) 기사를
somedaynews_article_tickers.json 제목과 조인해 키워드 규칙으로 뉴스 유형(다중 태그) 집계.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HITS = ROOT / "data/analysis/publish_5d_high_ge_10pct_entry_a_hold1_cohort.json"
TICKERS = ROOT / "data/somedaynews_article_tickers.json"
OUT = ROOT / "data/analysis/publish_5d_article_themes.json"

# (label, [regex patterns]) — 제목에 하나라도 매치되면 태그 (IGNORECASE)
CATEGORIES: list[tuple[str, list[str]]] = [
    (
        "FDA·미국규제",
        [
            r"\bFDA\b",
            r"\bNDA\b",
            r"\bBLA\b",
            r"\bIND\b",
            r"\bPDUFA\b",
            r"브레이크스루",
            r"Breakthrough",
            r"Fast\s+Track",
            r"오펀",
            r"Orphan",
            r"\bEMA\b",
            r"유럽의약품",
            r"미국\s*식품의약국",
        ],
    ),
    (
        "EU·체외진단(MDR/IVDR 등)",
        [
            r"\bIVDR\b",
            r"\bMDR\b",
            r"CE\s*[-·]?\s*IVDR",
            r"체외진단",
        ],
    ),
    (
        "국내허가·식약처",
        [
            r"식약처",
            r"품목허가",
            r"조건부허가",
            r"신약허가",
            r"허가신청",
            r"허가\s*심사",
            r"임상시험계획\s*승인",
            r"생물의약품",
            r"보험수가",
        ],
    ),
    (
        "임상·결과",
        [
            r"임상",
            r"1상",
            r"2상",
            r"3상",
            r"Phase\s*[123]",
            r"중간\s*분석",
            r"최종\s*분석",
            r"무작위",
            r"p값",
            r"유의미",
            r"엔드포인트",
            r"PRIME",
            r"CAR[- ]?T",
            r"투약\s*종료",
            r"중간발표",
            r"바우처",
            r"노보\s*노디스크",
        ],
    ),
    (
        "기술이전·수출·라이선스",
        [
            r"기술이전",
            r"기술수출",
            r"기술도입",
            r"Tech\s+Transfer",
            r"라이선스",
            r"License",
            r"공급계약",
            r"독점\s*판매",
            r"판권",
            r"수주",
            r"MOU",
            r"업무협약",
            r"공동\s*연구",
            r"CRO",
            r"CMO",
            r"전략적\s*파트너",
            r"글로벌\s*파트너",
        ],
    ),
    (
        "자금·CB·유증",
        [
            r"유상증자",
            r"전환사채",
            r"CB\s*발행",
            r"신주인수",
            r"자금\s*조달",
            r"투자유치",
            r"프리IPO",
            r"공모",
        ],
    ),
    (
        "M&A·지분·엑시트",
        [
            r"인수",
            r"매각",
            r"M&A",
            r"지분\s*투자",
            r"지분\s*매입",
            r"지분\s*택했",
            r"합병",
            r"스핀오프",
            r"엑시트",
            r"전부\s*팔",
        ],
    ),
    (
        "실적·가이던스",
        [
            r"실적",
            r"매출",
            r"영업이익",
            r"영업손실",
            r"당기순이익",
            r"가이던스",
            r"컨센서스",
            r"어닝",
            r"흑자",
            r"적자",
        ],
    ),
    (
        "특허·분쟁",
        [
            r"특허",
            r"특허침해",
            r"소송",
            r"금지가처분",
            r"\bITC\b",
            r"무효심판",
        ],
    ),
    (
        "거래·시장제도·공시",
        [
            r"관리종목",
            r"거래정지",
            r"상장폐지",
            r"유의종목",
            r"투자주의",
            r"투자경고",
            r"불성실",
            r"감사보고서",
        ],
    ),
    (
        "시황·테마·주가코멘터리",
        [
            r"맥짚기",
            r"테마주",
            r"상한가",
            r"급등",
            r"껑충",
            r"주가\s*[\'\"]?",
            r"시총\s*도전",
            r"목표시총",
            r"종목\s*맥짚기",
        ],
    ),
    (
        "해외진출·법인",
        [
            r"美\s*자회사",
            r"자회사\s*설립",
            r"日",
            r"美\s*진출",
            r"중국",
            r"유럽\s*시장",
        ],
    ),
    (
        "제품·상업화",
        [
            r"출시",
            r"본격\s*판매",
            r"점유율",
            r"판매",
        ],
    ),
    (
        "순위·기획·연재",
        [
            r"톱10",
            r"TOP10",
            r"유망바이오",
            r"기획",
            r"연재",
            r"대해부",
            r"K[- ]?바이오",
        ],
    ),
]


def compile_patterns() -> list[tuple[str, list[re.Pattern[str]]]]:
    out: list[tuple[str, list[re.Pattern[str]]]] = []
    for label, pats in CATEGORIES:
        compiled = []
        for p in pats:
            compiled.append(re.compile(p, re.IGNORECASE))
        out.append((label, compiled))
    return out


def tags_for_title(title: str, compiled: list[tuple[str, list[re.Pattern[str]]]]) -> list[str]:
    t = title or ""
    hit: list[str] = []
    for label, pats in compiled:
        if any(p.search(t) for p in pats):
            hit.append(label)
    return hit


def main() -> int:
    if not HITS.is_file() or not TICKERS.is_file():
        print("missing input json", file=sys.stderr)
        return 1

    hits = json.loads(HITS.read_text(encoding="utf-8"))["rows"]
    tick_rows = json.loads(TICKERS.read_text(encoding="utf-8"))

    # article_id -> title (첫 행 유지; 동일 기사는 보통 동일 제목)
    id_title: dict[str, str] = {}
    for row in tick_rows:
        aid = row.get("article_id")
        if aid and aid not in id_title:
            id_title[aid] = row.get("title") or ""

    compiled = compile_patterns()
    unique_ids = sorted({r["article_id"] for r in hits})

    per_article: list[dict] = []
    tag_counter = Counter()
    multi = Counter()
    unlabeled = 0

    for aid in unique_ids:
        title = id_title.get(aid, "")
        tags = tags_for_title(title, compiled)
        if not tags:
            unlabeled += 1
            tags = ["기타·미분류"]
        for tg in tags:
            tag_counter[tg] += 1
        multi[len(tags)] += 1
        per_article.append({"article_id": aid, "title": title, "tags": tags})

    # 히트 건수 기준(행): (article_id, ticker) 별 max_return 대표 1건으로 집계할 수도 있음
    # 여기서는 기사 단위 요약만
    payload = {
        "source_hits": str(HITS.relative_to(ROOT)),
        "source_titles": str(TICKERS.relative_to(ROOT)),
        "unique_articles": len(unique_ids),
        "tag_counts_article_level": dict(tag_counter.most_common()),
        "articles_with_no_keyword_match_before_fallback": unlabeled,
        "tag_count_per_article_histogram": {str(k): v for k, v in sorted(multi.items())},
        "articles": sorted(per_article, key=lambda x: x["article_id"]),
        "samples_by_tag": {},
    }

    # 샘플: 태그별 제목 5개
    by_tag: dict[str, list[str]] = defaultdict(list)
    for row in per_article:
        for tg in row["tags"]:
            if len(by_tag[tg]) < 5:
                by_tag[tg].append(row["title"][:120])
    payload["samples_by_tag"] = {k: v for k, v in sorted(by_tag.items())}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("기사 수(고유 article_id):", len(unique_ids))
    print("키워드 미매칭 → 기타:", unlabeled)
    print("\n태그별 기사 수 (다중 태그 허용, 합계 > 기사 수):")
    for k, v in tag_counter.most_common():
        print(f"  {k}: {v}")
    print("\n저장:", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
