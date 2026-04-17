#!/usr/bin/env python3
"""
data/somedaynews_article_tickers.json 각 행에 API의 free_conversion_at(무료 전환 시각)을 붙입니다.

- 날짜(`date` YYYY-MM-DD)마다 SomeDayNews API를 한 번 호출해 해당 일 기사 목록을 받고,
  article_id → free_conversion_at 맵을 만든 뒤 행에 병합합니다.
- 기존 키가 있으면 덮어씁니다(재실행 시 갱신).

  X_REQUEST_ID=... X_REQUEST_KEY=... python3 scripts/enrich_somedaynews_article_tickers_free_conversion.py

옵션:
  --in, --out   기본 data/somedaynews_article_tickers.json
  --delay       요청 간 대기(초), 기본 1.5
  --cache-dir   지정 시 일별 응답 JSON을 캐시(재실행 시 API 생략)
  --dry-run     파일 쓰지 않고 집계만
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SOMEDAYNEWS_URL = "https://pharmdev.edaily.co.kr/api/somedaynews"


def fetch_day(
    ymd: str,
    request_id: str,
    request_key: str,
    *,
    timeout: int,
) -> dict:
    body = json.dumps({"date": ymd}).encode("utf-8")
    req = Request(
        SOMEDAYNEWS_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Request-Id": request_id,
            "X-Request-Key": request_key,
            "User-Agent": "Mozilla/5.0 (fam-enrich/1.0)",
        },
        method="POST",
    )
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def article_map_from_response(data: dict) -> dict[str, str | None]:
    """article_id(str) -> free_conversion_at(str|None)"""
    out: dict[str, str | None] = {}
    arts = data.get("articles")
    if not isinstance(arts, list):
        return out
    for a in arts:
        if not isinstance(a, dict):
            continue
        aid = a.get("article_id")
        if aid is None:
            continue
        key = str(aid).strip()
        if not key:
            continue
        fca = a.get("free_conversion_at")
        if isinstance(fca, str) and fca.strip():
            out[key] = fca.strip()
        else:
            out[key] = None
    return out


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="article_tickers.json에 free_conversion_at 병합")
    parser.add_argument("--in", dest="in_path", default=str(root / "data" / "somedaynews_article_tickers.json"))
    parser.add_argument("--out", dest="out_path", default="")
    parser.add_argument("--delay", type=float, default=1.5, help="요청 간 대기(초)")
    parser.add_argument("--jitter", type=float, default=0.35)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--cache-dir", default="", help="일별 API JSON 캐시 디렉터리(선택)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    request_id = os.environ.get("X_REQUEST_ID", "").strip()
    request_key = os.environ.get("X_REQUEST_KEY", "").strip()
    if not request_id or not request_key:
        print("X_REQUEST_ID, X_REQUEST_KEY 환경변수를 설정하세요.", file=sys.stderr)
        sys.exit(1)

    in_path = Path(args.in_path)
    out_path = Path(args.out_path) if args.out_path else in_path
    if not in_path.is_file():
        print(f"파일 없음: {in_path}", file=sys.stderr)
        sys.exit(1)

    rows: list[dict] = json.loads(in_path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("JSON 루트는 배열이어야 합니다.", file=sys.stderr)
        sys.exit(1)

    dates: set[str] = set()
    for r in rows:
        if isinstance(r, dict) and isinstance(r.get("date"), str):
            d = r["date"].strip()[:10]
            if len(d) == 10 and d[4] == "-" and d[7] == "-":
                dates.add(d)

    sorted_dates = sorted(dates)
    cache_dir = Path(args.cache_dir) if args.cache_dir else None
    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)

    merged: dict[str, str | None] = {}
    for i, d_iso in enumerate(sorted_dates, 1):
        ymd = d_iso.replace("-", "")
        cache_file = cache_dir / f"{ymd}.json" if cache_dir else None

        if cache_file and cache_file.is_file():
            data = json.loads(cache_file.read_text(encoding="utf-8"))
        else:
            try:
                data = fetch_day(ymd, request_id, request_key, timeout=args.timeout)
            except (HTTPError, URLError, OSError, TimeoutError, json.JSONDecodeError) as e:
                print(f"[{i}/{len(sorted_dates)}] {ymd} 실패: {e}", file=sys.stderr)
                time.sleep(args.delay + random.uniform(0, args.jitter))
                continue
            if cache_file:
                cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

        part = article_map_from_response(data)
        merged.update(part)
        if i % 25 == 0 or i == len(sorted_dates):
            print(f"[{i}/{len(sorted_dates)}] {ymd} … 누적 article_id {len(merged)}", flush=True)

        if i < len(sorted_dates):
            time.sleep(args.delay + random.uniform(0, args.jitter))

    filled = 0
    missing_id = 0
    null_fca = 0
    for r in rows:
        if not isinstance(r, dict):
            continue
        aid = r.get("article_id")
        if aid is None:
            continue
        key = str(aid).strip()
        if not key:
            continue
        if key not in merged:
            missing_id += 1
            r["free_conversion_at"] = None
            continue
        v = merged[key]
        r["free_conversion_at"] = v
        if v is None:
            null_fca += 1
        else:
            filled += 1

    print(
        f"행 수: {len(rows)} | free_conversion_at 시각 있음: {filled} | null: {null_fca} | API에 article_id 없음: {missing_id}"
    )

    if args.dry_run:
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {out_path}")


if __name__ == "__main__":
    main()
