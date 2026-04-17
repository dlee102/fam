#!/usr/bin/env python3
"""
팜이데일리 API 테스트 스크립트
- 기존 크롤러(crawl-pharm, pharm_crawler) 사용 안 함
- API 응답 구조(sync_time, article_count, articles) 검증

사용법:
  python3 scripts/test_pharm_api.py --date 20250320 --request-id ... --request-key ...
  PHARM_REQUEST_ID=... PHARM_REQUEST_KEY=... python3 scripts/test_pharm_api.py --date 20250320
  PHARM_API_URL=https://pharmdev.edaily.co.kr/api/somedaynews python3 scripts/test_pharm_api.py --date 20250320
"""

import argparse
import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# 기대하는 API 응답 구조 (참고)
EXPECTED_KEYS = {"sync_time", "article_count", "articles"}


def fetch_api(
    *,
    url: str,
    date: str,
    request_id: str,
    request_key: str,
    timeout: int = 30,
) -> dict:
    """API URL로 POST 요청 후 JSON 파싱."""
    payload = json.dumps({"date": date}).encode("utf-8")
    req = Request(
        url,
        data=payload,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "X-Request-Id": request_id,
            "X-Request-Key": request_key,
        },
        method="POST",
    )
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def validate_response(data: dict) -> tuple[bool, list[str]]:
    """응답 구조 검증."""
    errors = []
    for key in EXPECTED_KEYS:
        if key not in data:
            errors.append(f"필수 필드 누락: {key}")
    if "articles" in data and not isinstance(data["articles"], list):
        errors.append("articles는 배열이어야 함")
    return len(errors) == 0, errors


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_mock = os.path.join(script_dir, "pharm_api_sample.json")

    parser = argparse.ArgumentParser(description="팜이데일리 API 테스트")
    parser.add_argument(
        "--url",
        default=os.environ.get("PHARM_API_URL", "https://pharmdev.edaily.co.kr/api/somedaynews"),
        help="API 엔드포인트 URL (또는 PHARM_API_URL 환경변수)",
    )
    parser.add_argument(
        "--date",
        default=os.environ.get("PHARM_DATE"),
        help="조회 날짜 (yyyyMMdd). mock 모드에선 무시됨.",
    )
    parser.add_argument(
        "--request-id",
        default=os.environ.get("PHARM_REQUEST_ID"),
        help="X-Request-Id (또는 PHARM_REQUEST_ID 환경변수)",
    )
    parser.add_argument(
        "--request-key",
        default=os.environ.get("PHARM_REQUEST_KEY"),
        help="X-Request-Key (또는 PHARM_REQUEST_KEY 환경변수)",
    )
    parser.add_argument(
        "--mock",
        metavar="FILE",
        nargs="?",
        const=default_mock,
        help="로컬 JSON 파일로 테스트 (기본: pharm_api_sample.json)",
    )
    parser.add_argument("--timeout", type=int, default=30, help="요청 타임아웃(초)")
    args = parser.parse_args()

    if args.mock:
        path = args.mock if isinstance(args.mock, str) else default_mock
        if not os.path.exists(path):
            print(f"오류: 파일 없음: {path}")
            sys.exit(1)
        print(f"로컬 파일 로드: {path}")
        print("-" * 50)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        url = (args.url or "").strip()
        date = (args.date or "").strip()
        request_id = (args.request_id or "").strip()
        request_key = (args.request_key or "").strip()

        missing = []
        if not url:
            missing.append("url")
        if not date:
            missing.append("date")
        if not request_id:
            missing.append("request-id")
        if not request_key:
            missing.append("request-key")
        if missing:
            print("오류: 필수 인자가 부족합니다:", ", ".join(missing))
            print("예시:")
            print("  python3 scripts/test_pharm_api.py --date 20250320 --request-id ... --request-key ...")
            print("  PHARM_REQUEST_ID=... PHARM_REQUEST_KEY=... python3 scripts/test_pharm_api.py --date 20250320")
            print("  python3 scripts/test_pharm_api.py --mock  # 샘플 JSON으로 구조 검증")
            sys.exit(1)

        print(f"요청 URL: {url}")
        print(f"요청 date: {date}")
        print("-" * 50)

        try:
            data = fetch_api(
                url=url,
                date=date,
                request_id=request_id,
                request_key=request_key,
                timeout=args.timeout,
            )
        except HTTPError as e:
            print(f"HTTP 오류: {e.code} {e.reason}")
            if e.fp:
                body = e.fp.read().decode("utf-8", errors="replace")[:500]
                print(f"응답 본문: {body}")
            sys.exit(1)
        except URLError as e:
            print(f"연결 오류: {e.reason}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
            sys.exit(1)

    ok, errs = validate_response(data)
    if not ok:
        print("구조 검증 실패:")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)

    print("✓ 구조 검증 통과")
    print(f"  sync_time: {data.get('sync_time')}")
    print(f"  article_count: {data.get('article_count')}")
    articles = data.get("articles", [])
    print(f"  articles 실제 개수: {len(articles)}")

    if articles:
        a = articles[0]
        print("\n첫 번째 기사 샘플:")
        print(f"  article_id: {a.get('article_id')}")
        print(f"  title: {a.get('title', '')[:60]}...")
        print(f"  body_text: {(a.get('body_text') or '')[:80]}...")
        print(f"  stock_codes: {a.get('stock_codes')}")
        print(f"  article_url: {a.get('article_url')}")

    print("\n✓ API 테스트 성공")


if __name__ == "__main__":
    main()
