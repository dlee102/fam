#!/usr/bin/env python3
"""
SomeDayNews 일별 JSON(data/somedaynews/*.json) 기사에 대해
Google Cloud Natural Language API — analyzeSentiment 호출 후 결과를 JSONL로 저장.

필수:
  - Google Cloud에서 **Cloud Natural Language API** 활성화
  - API 키: 환경변수 GOOGLE_API_KEY (또는 GCP_API_KEY)

  export GOOGLE_API_KEY='...'
  python3 scripts/somedaynews_google_sentiment.py

출력(기본): data/somedaynews_sentiment.jsonl (한 줄 = 한 기사, 이어받기)

요금: 문서당 과금(문자량 구간). 기본 --max-chars 로 본문을 잘라 비용을 줄입니다.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

NL_URL = "https://language.googleapis.com/v1/documents:analyzeSentiment"


def article_key(a: dict) -> str:
    return "|".join(
        [
            str(a.get("article_id", "")),
            str(a.get("status", "")),
            str(a.get("updated_at", "")),
        ]
    )


def build_text(a: dict, max_chars: int) -> str:
    title = (a.get("title") or "").strip()
    body = (a.get("body_text") or "").strip()
    if not body and (a.get("body_html") or "").strip():
        body = "[HTML 본문만 있음]"
    chunk = f"{title}\n\n{body}".strip()
    if len(chunk) <= max_chars:
        return chunk
    return chunk[: max_chars - 1] + "…"


def score_to_label(score: float) -> str:
    if score >= 0.25:
        return "positive"
    if score <= -0.25:
        return "negative"
    return "neutral"


def score_to_0_100(score: float) -> int:
    v = (score + 1.0) * 50.0
    return int(max(0, min(100, round(v))))


def call_analyze_sentiment(text: str, api_key: str, timeout: int) -> tuple[float, float]:
    if not text.strip():
        return 0.0, 0.0

    url = f"{NL_URL}?key={urllib.parse.quote(api_key, safe='')}"
    payload = {
        "document": {"type": "PLAIN_TEXT", "content": text, "language": "ko"},
        "encodingType": "UTF8",
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    doc = data.get("documentSentiment") or {}
    return float(doc.get("score", 0.0)), float(doc.get("magnitude", 0.0))


def load_done_keys(path: Path) -> set[str]:
    if not path.exists():
        return set()
    keys: set[str] = set()
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                keys.add(row.get("_key", ""))
            except json.JSONDecodeError:
                continue
    return {k for k in keys if k}


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="SomeDayNews + Google NL 감정 분석")
    parser.add_argument(
        "--input-dir",
        default=str(root / "data" / "somedaynews"),
        help="일별 JSON 디렉터리",
    )
    parser.add_argument(
        "--output",
        default=str(root / "data" / "somedaynews_sentiment.jsonl"),
        help="결과 JSONL 경로",
    )
    parser.add_argument("--max-chars", type=int, default=4000, help="기사당 API에 넘길 최대 글자 수")
    parser.add_argument("--delay", type=float, default=0.12, help="요청 간 대기(초)")
    parser.add_argument("--jitter", type=float, default=0.06, help="delay에 추가 랜덤(0~jitter)")
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--limit", type=int, default=0, help="처리 상한(0=전체, 디버그용)")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 기사 수만 집계")
    args = parser.parse_args()

    api_key = (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GCP_API_KEY") or "").strip()
    if not args.dry_run and not api_key:
        print(
            "GOOGLE_API_KEY(또는 GCP_API_KEY)를 설정하세요. Cloud Natural Language API가 켜진 프로젝트 키여야 합니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    input_dir = Path(args.input_dir)
    if not input_dir.is_dir():
        print(f"입력 디렉터리 없음: {input_dir}", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    done = load_done_keys(out_path)

    json_files = sorted(input_dir.glob("*.json"))
    total_articles = 0
    for jf in json_files:
        try:
            with open(jf, encoding="utf-8") as f:
                day = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        arts = day.get("articles")
        if isinstance(arts, list):
            total_articles += len(arts)

    if args.dry_run:
        print(f"일 파일: {len(json_files)}개, articles 합계: {total_articles}건")
        print(f"이미 처리(_key 기준): {len(done)}건 → {out_path}")
        return

    processed = 0
    skipped = 0
    errors = 0

    with open(out_path, "a", encoding="utf-8") as outf:
        for jf in json_files:
            try:
                with open(jf, encoding="utf-8") as f:
                    day = json.load(f)
            except (OSError, json.JSONDecodeError) as e:
                print(f"건너뜀 {jf.name}: {e}", file=sys.stderr)
                continue

            day_key = jf.stem
            arts = day.get("articles")
            if not isinstance(arts, list):
                continue

            for a in arts:
                if not isinstance(a, dict):
                    continue
                if not a.get("article_id"):
                    continue
                key = article_key(a)
                if key in done:
                    skipped += 1
                    continue

                if args.limit > 0 and processed >= args.limit:
                    print(f"--limit {args.limit} 도달, 종료")
                    print(f"처리 {processed}, 스킵 {skipped}, 오류 {errors}")
                    return

                text = build_text(a, args.max_chars)
                try:
                    g_score, g_mag = call_analyze_sentiment(text, api_key, args.timeout)
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode("utf-8", errors="replace")[:400]
                    print(f"HTTP {e.code} article_id={a.get('article_id')}: {err_body}", file=sys.stderr)
                    errors += 1
                    if e.code in (403, 400):
                        print("API 키·과금·API 활성화를 확인하세요.", file=sys.stderr)
                    time.sleep(2.0)
                    continue
                except urllib.error.URLError as e:
                    print(f"네트워크 오류 article_id={a.get('article_id')}: {e}", file=sys.stderr)
                    errors += 1
                    time.sleep(1.5)
                    continue

                row = {
                    "_key": key,
                    "source_file": jf.name,
                    "api_date": day_key,
                    "article_id": a.get("article_id"),
                    "article_url": a.get("article_url"),
                    "status": a.get("status"),
                    "title": a.get("title"),
                    "registered_date": a.get("registered_date"),
                    "published_at": a.get("published_at"),
                    "updated_at": a.get("updated_at"),
                    "google_nlp_score": g_score,
                    "google_nlp_magnitude": g_mag,
                    "sentiment_score": score_to_0_100(g_score),
                    "sentiment_label": score_to_label(g_score),
                }
                outf.write(json.dumps(row, ensure_ascii=False) + "\n")
                outf.flush()
                done.add(key)
                processed += 1

                if processed % 50 == 0:
                    print(f"… {processed}건 저장 ({day_key})", flush=True)

                time.sleep(args.delay + random.uniform(0, args.jitter))

    print(f"완료: 신규 처리 {processed}건, 스킵 {skipped}건, 오류 {errors}건 → {out_path}")


if __name__ == "__main__":
    main()
