#!/usr/bin/env python3
"""
SomeDayNews 일별 JSON 저장 (과거 → 오늘). API 호출 간격·재시도·이어받기.

  X_REQUEST_ID=... X_REQUEST_KEY=... python3 scripts/download_somedaynews_range.py

옵션:
  --start 20200808   기본: API에 데이터 있는 가장 이른 날
  --end              기본: 오늘(로컬 날짜)
  --out-dir          기본: 프로젝트 루트 data/somedaynews
  --delay 2.0        요청 사이 대기(초)
  --retries 4        실패·429 시 재시도
  --force            이미 있는 파일도 덮어쓰기

이후 평탄화: `python3 scripts/build_somedaynews_article_tickers.py` 로 `data/somedaynews_article_tickers.json` 갱신
(API `published_at`·종목·**유료 기사만** 기본).
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SOMEDAYNEWS_URL = "https://pharmdev.edaily.co.kr/api/somedaynews"
DEFAULT_START = date(2020, 8, 8)


def daterange_inclusive(start: date, end: date) -> list[date]:
    if end < start:
        return []
    out = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def ymd(d: date) -> str:
    return d.strftime("%Y%m%d")


def fetch_once(date_str: str, request_id: str, request_key: str, timeout: int) -> dict:
    body = json.dumps({"date": date_str}).encode("utf-8")
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


def fetch_with_retries(
    date_str: str,
    request_id: str,
    request_key: str,
    *,
    timeout: int,
    retries: int,
    base_delay: float,
) -> dict:
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return fetch_once(date_str, request_id, request_key, timeout=timeout)
        except HTTPError as e:
            last_err = e
            if e.code == 429 or (500 <= e.code < 600):
                wait = base_delay * (2**attempt) + random.uniform(0, 0.5)
                print(f"  HTTP {e.code}, {wait:.1f}s 후 재시도 ({attempt + 1}/{retries})")
                time.sleep(wait)
                continue
            raise
        except (URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            last_err = e
            wait = base_delay * (2**attempt) + random.uniform(0, 0.5)
            print(f"  오류 {type(e).__name__}: {e} — {wait:.1f}s 후 재시도 ({attempt + 1}/{retries})")
            time.sleep(wait)
            continue
    assert last_err is not None
    raise last_err


def parse_ymd(s: str) -> date:
    return datetime.strptime(s, "%Y%m%d").date()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    default_out = root / "data" / "somedaynews"

    parser = argparse.ArgumentParser(description="SomeDayNews 일별 다운로드")
    parser.add_argument("--start", default=ymd(DEFAULT_START), help="시작일 YYYYMMDD")
    parser.add_argument(
        "--end",
        default="",
        help="종료일 YYYYMMDD (기본: 오늘)",
    )
    parser.add_argument("--out-dir", default=str(default_out), help="저장 디렉터리")
    parser.add_argument("--delay", type=float, default=2.0, help="요청 사이 대기(초)")
    parser.add_argument("--jitter", type=float, default=0.35, help="delay에 더할 랜덤(0~jitter)")
    parser.add_argument("--retries", type=int, default=4, help="실패 시 재시도 횟수")
    parser.add_argument("--timeout", type=int, default=120, help="요청 타임아웃(초)")
    parser.add_argument("--force", action="store_true", help="기존 파일 덮어쓰기")
    parser.add_argument(
        "--max-days",
        type=int,
        default=0,
        help="디버그: 최대 N일만 처리 후 종료 (0=제한 없음)",
    )
    args = parser.parse_args()

    request_id = os.environ.get("X_REQUEST_ID", "").strip()
    request_key = os.environ.get("X_REQUEST_KEY", "").strip()
    if not request_id or not request_key:
        print("X_REQUEST_ID, X_REQUEST_KEY 환경변수를 설정하세요.", file=sys.stderr)
        sys.exit(1)

    start_d = parse_ymd(args.start)
    end_d = parse_ymd(args.end) if args.end.strip() else date.today()
    if end_d < start_d:
        print("종료일이 시작일보다 이릅니다.", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    days = daterange_inclusive(start_d, end_d)
    if args.max_days > 0:
        days = days[: args.max_days]

    total = len(days)
    print(f"기간: {ymd(start_d)} ~ {ymd(end_d)} ({total}일)")
    print(f"저장: {out_dir}")
    print(f"요청 간격: {args.delay}s + 0~{args.jitter}s jitter")
    print()

    ok = skip = fail = 0
    for i, d in enumerate(days, start=1):
        key = ymd(d)
        path = out_dir / f"{key}.json"
        if path.exists() and not args.force:
            skip += 1
            if i % 50 == 0 or i == total:
                print(f"[{i}/{total}] {key} skip (exists)")
            continue

        print(f"[{i}/{total}] {key} …", flush=True)
        try:
            data = fetch_with_retries(
                key,
                request_id,
                request_key,
                timeout=args.timeout,
                retries=args.retries,
                base_delay=max(args.delay, 1.0),
            )
        except Exception as e:
            print(f"  실패: {e}", file=sys.stderr)
            fail += 1
            time.sleep(args.delay + random.uniform(0, args.jitter))
            continue

        ac = data.get("article_count")
        arts = data.get("articles")
        if not isinstance(arts, list):
            print("  경고: articles가 배열이 아님", file=sys.stderr)
        elif isinstance(ac, int) and ac != len(arts):
            print(f"  경고: article_count={ac} != len(articles)={len(arts)}", file=sys.stderr)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        ok += 1
        print(f"  저장 {path.name} (article_count={ac})")

        if i < total:
            time.sleep(args.delay + random.uniform(0, args.jitter))

    print()
    print(f"완료: 성공 {ok}, 스킵 {skip}, 실패 {fail}")


if __name__ == "__main__":
    main()
