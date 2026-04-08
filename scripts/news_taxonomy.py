"""뉴스 기사 유형 라벨 — `analyze_publish_5d_article_themes.py`의 CATEGORIES와 동일 순서·문구."""

from __future__ import annotations

# 키워드 스크립트와 맞춤; Gemini 분류 enum에 사용
ARTICLE_TYPE_LABELS_KO: tuple[str, ...] = (
    "FDA·미국규제",
    "EU·체외진단(MDR/IVDR 등)",
    "국내허가·식약처",
    "임상·결과",
    "기술이전·수출·라이선스",
    "자금·CB·유증",
    "M&A·지분·엑시트",
    "실적·가이던스",
    "특허·분쟁",
    "거래·시장제도·공시",
    "시황·테마·주가코멘터리",
    "해외진출·법인",
    "제품·상업화",
    "순위·기획·연재",
    "기타·미분류",
)
