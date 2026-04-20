#!/usr/bin/env python3
"""
data/somedaynews_article_tickers.json 각 행에 API 메타를 붙입니다.

- `free_conversion_at`(무료 전환 시각)
- `score`(팜이데일리 노출 점수, 정수·**클수록 좋음**. API 빈 문자열이면 null)

모드:

1) 기본: 날짜(`date` YYYY-MM-DD)마다 SomeDayNews API를 한 번 호출해 병합
2) `--from-json-dir DIR`: DIR 아래 `YYYYMMDD.json`만 읽어 병합(API·키 불필요)
3) `--cache-dir`: API 응답을 일별로 캐시(재실행 시 해당 일은 파일 우선)
4) `--refetch`: `--cache-dir`에 파일이 있어도 API로 다시 받아 캐시·score 갱신(구버전 JSON에 score 없을 때)

  X_REQUEST_ID=... X_REQUEST_KEY=... python3 scripts/enrich_somedaynews_article_tickers_free_conversion.py

  python3 scripts/enrich_somedaynews_article_tickers_free_conversion.py --from-json-dir data/somedaynews

  X_REQUEST_ID=... X_REQUEST_KEY=... python3 scripts/enrich_somedaynews_article_tickers_free_conversion.py --cache-dir data/somedaynews --refetch

옵션:
  --in, --out   기본 data/somedaynews_article_tickers.json
  --delay       요청 간 대기(초), 기본 1.5
  --cache-dir   지정 시 일별 응답 JSON을 캐시(재실행 시 API 생략, `--refetch` 제외)
  --refetch     캐시 무시하고 API 재호출 후 캐시 덮어쓰기
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


def parse_article_score_val(raw: object) -> int | None:
    if raw is None:
        return None
    t = str(raw).strip()
    if not t:
        return None
    try:
        return int(t)
    except ValueError:
        try:
            return int(float(t))
        except ValueError:
            return None


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


def article_meta_from_response(data: dict) -> dict[str, dict]:
    """article_id -> { free_conversion_at, score }"""
    out: dict[str, dict] = {}
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
        fca_out: str | None
        if isinstance(fca, str) and fca.strip():
            fca_out = fca.strip()
        else:
            fca_out = None
        out[key] = {
            "free_conversion_at": fca_out,
            "score": parse_article_score_val(a.get("score")),
        }
    return out


def merge_meta_accum(into: dict[str, dict], part: dict[str, dict]) -> None:
    """같은 article_id가 여러 일 파일에 있으면 score는 더 큰 값, free_conversion_at은 비어 있지 않은 값 우선."""
    for aid, meta in part.items():
        if aid not in into:
            into[aid] = dict(meta)
            continue
        cur = into[aid]
        ns, os_ = meta.get("score"), cur.get("score")
        if ns is not None and os_ is not None:
            cur["score"] = max(ns, os_)
        elif ns is not None:
            cur["score"] = ns
        nf, of = meta.get("free_conversion_at"), cur.get("free_conversion_at")
        if isinstance(nf, str) and nf.strip():
            cur["free_conversion_at"] = nf.strip()
        elif of is None and nf is None:
            cur["free_conversion_at"] = None


def load_meta_from_json_dir(indir: Path, *, only_ids: set[str] | None) -> dict[str, dict]:
    merged: dict[str, dict] = {}
    for path in sorted(indir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"건너뜀 {path.name}: {e}", file=sys.stderr)
            continue
        part = article_meta_from_response(data)
        if only_ids is not None:
            part = {k: v for k, v in part.items() if k in only_ids}
        merge_meta_accum(merged, part)
    return merged


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="article_tickers.json에 free_conversion_at·score 병합")
    parser.add_argument("--in", dest="in_path", default=str(root / "data" / "somedaynews_article_tickers.json"))
    parser.add_argument("--out", dest="out_path", default="")
    parser.add_argument("--delay", type=float, default=1.5, help="요청 간 대기(초)")
    parser.add_argument("--jitter", type=float, default=0.35)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--cache-dir", default="", help="일별 API JSON 캐시 디렉터리(선택)")
    parser.add_argument(
        "--refetch",
        action="store_true",
        help="캐시 파일이 있어도 API로 다시 받아 저장(score 등 필드 갱신)",
    )
    parser.add_argument(
        "--from-json-dir",
        default="",
        help="일별 SomeDayNews JSON 디렉터리만 읽기(API 호출·인증 생략)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out_path) if args.out_path else in_path
    if not in_path.is_file():
        print(f"파일 없음: {in_path}", file=sys.stderr)
        sys.exit(1)

    rows: list[dict] = json.loads(in_path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("JSON 루트는 배열이어야 합니다.", file=sys.stderr)
        sys.exit(1)

    from_dir = (args.from_json_dir or "").strip()
    if from_dir:
        indir = Path(from_dir)
        if not indir.is_dir():
            print(f"디렉터리 없음: {indir}", file=sys.stderr)
            sys.exit(1)
        only_ids = {
            str(r.get("article_id", "")).strip()
            for r in rows
            if isinstance(r, dict) and str(r.get("article_id", "")).strip()
        }
        merged = load_meta_from_json_dir(indir, only_ids=only_ids)
    else:
        request_id = os.environ.get("X_REQUEST_ID", "").strip()
        request_key = os.environ.get("X_REQUEST_KEY", "").strip()
        if not request_id or not request_key:
            print("X_REQUEST_ID, X_REQUEST_KEY 환경변수를 설정하거나 --from-json-dir 을 쓰세요.", file=sys.stderr)
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

        merged = {}
        for i, d_iso in enumerate(sorted_dates, 1):
            ymd = d_iso.replace("-", "")
            cache_file = cache_dir / f"{ymd}.json" if cache_dir else None

            if cache_file and cache_file.is_file() and not args.refetch:
                data = json.loads(cache_file.read_text(encoding="utf-8"))
            else:
                data = None
                last_err: Exception | None = None
                for attempt in range(3):
                    try:
                        data = fetch_day(ymd, request_id, request_key, timeout=args.timeout)
                        break
                    except (HTTPError, URLError, OSError, TimeoutError, json.JSONDecodeError) as e:
                        last_err = e
                        time.sleep((args.delay + random.uniform(0, args.jitter)) * (attempt + 1))
                if data is None:
                    assert last_err is not None
                    print(f"[{i}/{len(sorted_dates)}] {ymd} 실패: {last_err}", file=sys.stderr)
                    time.sleep(args.delay + random.uniform(0, args.jitter))
                    continue
                if cache_file:
                    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

            part = article_meta_from_response(data)
            merge_meta_accum(merged, part)
            if i % 25 == 0 or i == len(sorted_dates):
                print(f"[{i}/{len(sorted_dates)}] {ymd} … 누적 article_id {len(merged)}", flush=True)

            if i < len(sorted_dates):
                time.sleep(args.delay + random.uniform(0, args.jitter))

    filled_fca = null_fca = missing_id = 0
    filled_score = null_score = 0
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
            r["score"] = None
            continue
        meta = merged[key]
        v = meta.get("free_conversion_at")
        r["free_conversion_at"] = v
        if v is None:
            null_fca += 1
        else:
            filled_fca += 1
        sv = meta.get("score")
        r["score"] = sv
        if sv is None:
            null_score += 1
        else:
            filled_score += 1

    print(
        f"행 수: {len(rows)} | free_conversion_at 있음: {filled_fca} | null: {null_fca} | "
        f"score 있음: {filled_score} | score null: {null_score} | 맵에 article_id 없음: {missing_id}"
    )

    if args.dry_run:
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {out_path}")


if __name__ == "__main__":
    main()
