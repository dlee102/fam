#!/usr/bin/env python3
"""
SomeDayNews API 테스트 스크립트
- POST https://pharmdev.edaily.co.kr/api/somedaynews
- sample.json / SomeDayNews api response spec v260310.xlsx 구조 검증

사용법:
  X_REQUEST_ID=xxx X_REQUEST_KEY=yyy python3 scripts/test_somedaynews_api.py
  python3 scripts/test_somedaynews_api.py --date 20260103
  python3 scripts/test_somedaynews_api.py --mock  # sample.json 로컬 검증
"""

import argparse
import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SOMEDAYNEWS_URL = "https://pharmdev.edaily.co.kr/api/somedaynews"

# SomeDayNews api response spec v260310.csv 기준
ARTICLE_REQUIRED = {
    "article_id": str,
    "article_url": str,
    "status": str,
    "is_paid": bool,
    "title": str,
    "subtitle": str,
    "body_html": str,
    "body_text": str,
    "reporter": dict,
    "category": dict,
    "keywords": list,
    "stock_codes": list,
    "registered_date": str,
    "published_at": str,
    "updated_at": str,
}
ARTICLE_OPTIONAL_NULLABLE = {"image_list", "free_conversion_at"}
REPORTER_REQUIRED = {"id": str, "name": str}
CATEGORY_REQUIRED = {"pharm_category_code": str, "edaily_category_code": str}
IMAGE_ITEM_REQUIRED = {"url": str, "caption": str, "orders": int}


def _check_type(val, expected, path: str) -> list[str]:
    errs = []
    if expected is str and not isinstance(val, str):
        errs.append(f"{path}: string 아님 (got {type(val).__name__})")
    elif expected is int and not isinstance(val, int):
        errs.append(f"{path}: int 아님 (got {type(val).__name__})")
    elif expected is bool and not isinstance(val, bool):
        errs.append(f"{path}: boolean 아님 (got {type(val).__name__})")
    elif expected is list and not isinstance(val, list):
        errs.append(f"{path}: array 아님 (got {type(val).__name__})")
    elif expected is dict and not isinstance(val, dict):
        errs.append(f"{path}: object 아님 (got {type(val).__name__})")
    return errs


def _validate_article(article: dict, idx: int) -> list[str]:
    errs = []
    prefix = f"articles[{idx}]"

    for key, typ in ARTICLE_REQUIRED.items():
        if key not in article:
            errs.append(f"{prefix}.{key}: 필수 필드 누락")
        else:
            errs.extend(_check_type(article[key], typ, f"{prefix}.{key}"))

    if "reporter" in article and isinstance(article["reporter"], dict):
        for k, typ in REPORTER_REQUIRED.items():
            if k not in article["reporter"]:
                errs.append(f"{prefix}.reporter.{k}: 필수 필드 누락")
            else:
                errs.extend(_check_type(article["reporter"][k], typ, f"{prefix}.reporter.{k}"))

    if "category" in article and isinstance(article["category"], dict):
        for k, typ in CATEGORY_REQUIRED.items():
            if k not in article["category"]:
                errs.append(f"{prefix}.category.{k}: 필수 필드 누락")
            else:
                errs.extend(_check_type(article["category"][k], typ, f"{prefix}.category.{k}"))

    if "keywords" in article and isinstance(article["keywords"], list):
        for i, v in enumerate(article["keywords"]):
            if not isinstance(v, str):
                errs.append(f"{prefix}.keywords[{i}]: string 아님")

    if "stock_codes" in article and isinstance(article["stock_codes"], list):
        for i, v in enumerate(article["stock_codes"]):
            if not isinstance(v, str):
                errs.append(f"{prefix}.stock_codes[{i}]: string 아님")

    if "image_list" in article and article["image_list"] is not None and isinstance(article["image_list"], list):
        for i, img in enumerate(article["image_list"]):
            if not isinstance(img, dict):
                errs.append(f"{prefix}.image_list[{i}]: object 아님")
            else:
                for k, typ in IMAGE_ITEM_REQUIRED.items():
                    if k not in img:
                        errs.append(f"{prefix}.image_list[{i}].{k}: 필수 필드 누락")
                    else:
                        errs.extend(_check_type(img[k], typ, f"{prefix}.image_list[{i}].{k}"))

    return errs


def validate_response(data: dict) -> tuple[bool, list[str]]:
    """SomeDayNews api response spec v260310.csv 기준 검증."""
    errors = []

    if "sync_time" in data and data["sync_time"] is not None:
        errors.extend(_check_type(data["sync_time"], str, "sync_time"))

    if "article_count" not in data:
        errors.append("article_count: 필수 필드 누락")
    else:
        errors.extend(_check_type(data["article_count"], int, "article_count"))

    if "articles" not in data:
        errors.append("articles: 필수 필드 누락")
    elif not isinstance(data["articles"], list):
        errors.append("articles: array 아님")
    else:
        for i, art in enumerate(data["articles"]):
            errors.extend(_validate_article(art, i))

    return len(errors) == 0, errors


def fetch_somedaynews(
    date: str,
    request_id: str,
    request_key: str,
    timeout: int = 30,
) -> dict:
    """SomeDayNews API POST 요청."""
    body = json.dumps({"date": date}).encode("utf-8")
    req = Request(
        SOMEDAYNEWS_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Request-Id": request_id,
            "X-Request-Key": request_key,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        method="POST",
    )
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def main() -> None:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_mock = os.path.join(base_dir, "sample.json")

    parser = argparse.ArgumentParser(description="SomeDayNews API 테스트")
    parser.add_argument(
        "--date",
        default="20260103",
        help="조회 날짜 (YYYYMMDD, 기본: 20260103)",
    )
    parser.add_argument(
        "--request-id",
        default=os.environ.get("X_REQUEST_ID", ""),
        help="X-Request-Id (또는 X_REQUEST_ID 환경변수)",
    )
    parser.add_argument(
        "--request-key",
        default=os.environ.get("X_REQUEST_KEY", ""),
        help="X-Request-Key (또는 X_REQUEST_KEY 환경변수)",
    )
    parser.add_argument(
        "--mock",
        metavar="FILE",
        nargs="?",
        const=default_mock,
        help="로컬 JSON으로 검증 (기본: sample.json)",
    )
    parser.add_argument("--timeout", type=int, default=30)
    args = parser.parse_args()

    if args.mock:
        path = args.mock if isinstance(args.mock, str) else default_mock
        if not os.path.exists(path):
            print(f"오류: 파일 없음: {path}")
            sys.exit(1)
        print(f"로컬 파일 검증: {path}")
        print("-" * 50)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        rid, rkey = args.request_id.strip(), args.request_key.strip()
        if not rid or not rkey:
            print("오류: X-Request-Id, X-Request-Key 필요")
            print("  X_REQUEST_ID=xxx X_REQUEST_KEY=yyy python3 scripts/test_somedaynews_api.py")
            print("  python3 scripts/test_somedaynews_api.py --request-id xxx --request-key yyy")
            print("  python3 scripts/test_somedaynews_api.py --mock  # sample.json 로컬 검증")
            sys.exit(1)

        print(f"POST {SOMEDAYNEWS_URL}")
        print(f"Body: {{\"date\": \"{args.date}\"}}")
        print("-" * 50)

        try:
            data = fetch_somedaynews(
                args.date, rid, rkey, timeout=args.timeout
            )
        except HTTPError as e:
            print(f"HTTP 오류: {e.code} {e.reason}")
            if e.fp:
                body = e.fp.read().decode("utf-8", errors="replace")[:500]
                print(f"응답: {body}")
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
        print("\n첫 번째 기사:")
        print(f"  article_id: {a.get('article_id')}")
        print(f"  title: {(a.get('title') or '')[:55]}...")
        print(f"  body_text: {(a.get('body_text') or '')[:70]}...")
        print(f"  stock_codes: {a.get('stock_codes')}")
        print(f"  article_url: {a.get('article_url')}")

    print("\n✓ API 테스트 성공")


if __name__ == "__main__":
    main()
