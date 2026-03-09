#!/usr/bin/env python3
"""
pharm_articles.json에서 기사별 종목(6자리 티커) 추출
패턴: 회사명(011690) 형태 → r'\((\d{6})\)' 정규식
"""

import json
import re
from pathlib import Path

INPUT = Path(__file__).parent / "pharm_articles.json"
OUTPUT = Path(__file__).parent / "pharm_articles_with_tickers.json"

TICKER_PATTERN = re.compile(r"\((\d{6})\)")


def extract_tickers(text: str | None) -> list[str]:
    """텍스트에서 6자리 종목코드 추출 (중복 제거, 등장 순서 유지)."""
    if not text:
        return []
    found = TICKER_PATTERN.findall(text)
    return list(dict.fromkeys(found))


def main():
    if not INPUT.exists():
        raise FileNotFoundError(f"입력 파일 없음: {INPUT}")

    with open(INPUT, encoding="utf-8") as f:
        articles = json.load(f)

    total_tickers = 0
    articles_with_tickers = 0

    for a in articles:
        title = a.get("title") or ""
        body = a.get("body") or ""
        text = title + "\n" + body
        tickers = extract_tickers(text)
        a["tickers"] = tickers
        if tickers:
            articles_with_tickers += 1
            total_tickers += len(tickers)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print(f"처리 완료: {len(articles)}개 기사")
    print(f"종목 추출된 기사: {articles_with_tickers}개")
    print(f"총 추출 티커 수: {total_tickers}개 (중복 제거 후)")
    print(f"저장: {OUTPUT}")


if __name__ == "__main__":
    main()
