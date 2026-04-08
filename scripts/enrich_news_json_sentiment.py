#!/usr/bin/env python3
"""Add Gemini labels to news JSON: sentiment, article types (FDA·임상 등), stock catalyst (호재/악재 등).

Supports:
  - Root array (e.g. somedaynews_article_tickers.json)
  - Object with \"rows\" (article_ai_rank_demo.json)
  - Object with \"articles\" (publish_5d_article_themes.json)

Deduplicates by article_id when present, else by normalized title. Uses a JSON cache
under data/.cache/ so re-runs are cheap.

Usage:
  export GOOGLE_API_KEY=...
  .venv/bin/python scripts/enrich_news_json_sentiment.py data/article_ai_rank_demo.json
  .venv/bin/python scripts/enrich_news_json_sentiment.py data/analysis/publish_5d_article_themes.json
  .venv/bin/python scripts/enrich_news_json_sentiment.py data/somedaynews_article_tickers.json --limit 500
  # 대량: 호출 간 ~1.2s+지터, 35건마다 쿨다운. 출력은 기본적으로 매 건마다 -o 파일에 증분 저장.
  # 끝에만 쓰기: --no-incremental-output  /  디스크 덜 쓰기: --write-every 10
  # 속도: --fast (간격 짧게·쿨다운 끔) 또는 --workers 3 (병렬, 503 위험↑)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

_REPO_ROOT = Path(__file__).resolve().parents[1]
if load_dotenv:
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local", override=True)

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from news_sentiment_gemini import classify_article, is_overload_error


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_title(s: str) -> str:
    return " ".join(s.strip().split())


def _dedupe_key(rec: dict[str, Any], text_key: str) -> str:
    aid = rec.get("article_id")
    if aid is not None and str(aid).strip():
        return f"id:{aid}"
    title = rec.get(text_key) or ""
    h = hashlib.sha256(_norm_title(str(title)).encode("utf-8")).hexdigest()[:16]
    return f"title:{h}"


def _split_payload(
    data: Any,
) -> tuple[list[dict[str, Any]], str, dict[str, Any] | None]:
    """Return (records, mode, wrapper) where wrapper is set if mutating a dict root."""
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)], "list", None
    if isinstance(data, dict):
        if "rows" in data and isinstance(data["rows"], list):
            rows = [x for x in data["rows"] if isinstance(x, dict)]
            return rows, "rows", data
        if "articles" in data and isinstance(data["articles"], list):
            arts = [x for x in data["articles"] if isinstance(x, dict)]
            return arts, "articles", data
    raise ValueError(
        "Unsupported JSON shape: expected a list, or dict with 'rows' or 'articles'."
    )


def _apply_classification_fields(rec: dict[str, Any], out: dict[str, Any]) -> None:
    rec["sentiment"] = out["sentiment"]
    rec["sentiment_label_ko"] = out["label_ko"]
    rec["sentiment_confidence"] = out["confidence"]
    rec["sentiment_reason"] = out["brief_reason"]
    rec["article_types_ko"] = out["article_types_ko"]
    rec["article_primary_type_ko"] = out["primary_type_ko"]
    rec["stock_catalyst"] = out["stock_catalyst"]
    rec["stock_catalyst_label_ko"] = out["stock_catalyst_label_ko"]
    rec["type_brief_ko"] = out["type_brief_ko"]


def _atomic_write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(obj, ensure_ascii=False, indent=2)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini 감성 태깅으로 뉴스 JSON 보강")
    parser.add_argument(
        "input",
        type=Path,
        help="입력 JSON 경로 (repo 기준 또는 절대 경로)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="출력 경로 (기본: 입력 파일 덮어쓰기)",
    )
    parser.add_argument(
        "--text-key",
        default="title",
        help="기사 텍스트 필드명 (기본: title)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="API 호출 상한(고유 키 기준). 0이면 제한 없음",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=1.2,
        help="성공 후 다음 호출까지 기본 대기(초). 503 줄이려면 1.0~2.0 권장",
    )
    parser.add_argument(
        "--sleep-jitter",
        type=float,
        default=0.4,
        help="추가 지터: 0~이 값(초) 사이를 무작위로 더 쉼 (기본 0.4)",
    )
    parser.add_argument(
        "--cooldown-every",
        type=int,
        default=35,
        help="이 건마다 추가 휴식(0이면 비활성)",
    )
    parser.add_argument(
        "--cooldown-seconds",
        type=float,
        default=28.0,
        help="cooldown-every 시 추가 대기(초)",
    )
    parser.add_argument(
        "--max-key-retries",
        type=int,
        default=12,
        help="한 기사(키)당 과부하 오류 시 최대 재시도 횟수",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=_REPO_ROOT / "data" / ".cache" / "article_news_classify_gemini.json",
        help="캐시 JSON 경로 (감성+유형 통합 응답)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Gemini 모델 ID (기본: GEMINI_MODEL 환경변수)",
    )
    parser.add_argument(
        "--no-incremental-output",
        action="store_true",
        help="출력 JSON을 마지막에만 쓰기 (기본: 매 건마다 또는 --write-every 주기로 갱신)",
    )
    parser.add_argument(
        "--write-every",
        type=int,
        default=1,
        help="증분 저장: N건 성공마다 출력 파일 갱신 (기본 1=실시간)",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="sleep≈0.35s·지터↓·쿨다운 끔 (빠름, 503/429 가능성 증가)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="병렬 워커 수(기본 1). 2~4면 처리량↑, API 과부하·503↑",
    )
    args = parser.parse_args()
    if args.fast:
        args.sleep = 0.35
        args.sleep_jitter = 0.12
        args.cooldown_every = 0

    in_path = args.input if args.input.is_absolute() else _REPO_ROOT / args.input
    if not in_path.is_file():
        print(f"File not found: {in_path}", file=sys.stderr)
        sys.exit(1)

    out_path = args.output or in_path
    if args.output and not args.output.is_absolute():
        out_path = _REPO_ROOT / args.output

    text_key = args.text_key
    raw = json.loads(in_path.read_text(encoding="utf-8"))
    records, mode, wrapper = _split_payload(raw)

    args.cache.parent.mkdir(parents=True, exist_ok=True)
    cache: dict[str, Any] = {}
    if args.cache.is_file():
        try:
            cache = json.loads(args.cache.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            cache = {}

    # Unique keys in stable order (first appearance)
    ordered_keys: list[str] = []
    seen: set[str] = set()
    key_to_text: dict[str, str] = {}
    for rec in records:
        k = _dedupe_key(rec, text_key)
        t = rec.get(text_key)
        if not isinstance(t, str) or not t.strip():
            continue
        if k not in seen:
            seen.add(k)
            ordered_keys.append(k)
            key_to_text[k] = t.strip()

    def _cache_hit_complete(v: Any) -> bool:
        if not isinstance(v, dict):
            return False
        return all(
            k in v
            for k in (
                "article_types_ko",
                "primary_type_ko",
                "stock_catalyst",
                "stock_catalyst_label_ko",
                "type_brief_ko",
            )
        )

    to_fetch = [k for k in ordered_keys if k not in cache or not _cache_hit_complete(cache[k])]
    if args.limit > 0:
        to_fetch = to_fetch[: args.limit]

    print(f"Records: {len(records)}  unique texts: {len(ordered_keys)}  to classify: {len(to_fetch)}", flush=True)

    incremental_out = not args.no_incremental_output
    write_every = max(1, args.write_every)
    note = "Gemini: sentiment + article_types_ko + stock_catalyst (호재/악재 등)"
    workers = max(1, min(32, args.workers))
    if workers != args.workers:
        print(f"  (workers clamped to {workers})", flush=True)

    def _classify_key_with_retries(k: str) -> dict[str, Any]:
        text = key_to_text[k]
        result: dict[str, Any] | None = None
        for key_try in range(args.max_key_retries):
            try:
                result = classify_article(text, model=args.model)
                break
            except Exception as exc:
                if is_overload_error(exc) and key_try + 1 < args.max_key_retries:
                    backoff = min(
                        240.0,
                        45.0 * (2**key_try) + random.uniform(0, 22.0),
                    )
                    print(
                        f"  overload on {k!r}, sleep {backoff:.0f}s "
                        f"(retry {key_try + 1}/{args.max_key_retries})",
                        flush=True,
                    )
                    time.sleep(backoff)
                    continue
                print(f"API error at key {k!r}: {exc}", file=sys.stderr)
                sys.exit(2)
        if result is None:
            print(f"API gave no result for key {k!r}", file=sys.stderr)
            sys.exit(2)
        return result

    def _merge_cache_into_records() -> None:
        for rec in records:
            t = rec.get(text_key)
            if not isinstance(t, str) or not t.strip():
                continue
            k = _dedupe_key(rec, text_key)
            hit = cache.get(k)
            if hit and _cache_hit_complete(hit):
                _apply_classification_fields(rec, hit)

    def _write_output_file(*, final: bool) -> None:
        _merge_cache_into_records()
        if wrapper is not None:
            wrapper["sentiment_source"] = "gemini"
            wrapper["news_classification_note"] = note
            if final:
                wrapper["sentiment_enriched_at"] = _utc_now_iso()
                wrapper.pop("sentiment_partial_updated_at", None)
            else:
                wrapper["sentiment_partial_updated_at"] = _utc_now_iso()
        out_obj: Any = wrapper if wrapper is not None else records
        _atomic_write_json(out_path, out_obj)
        tag = "완료" if final else "증분"
        print(f"  >> [{tag}] wrote {out_path}", flush=True)

    def _pace_after_success(i: int) -> None:
        if i + 1 >= len(to_fetch):
            return
        base = args.sleep
        if base > 0:
            jitter = random.uniform(0, max(0.0, args.sleep_jitter))
            time.sleep(base + jitter)
        if args.cooldown_every > 0 and args.cooldown_seconds > 0:
            if (i + 1) % args.cooldown_every == 0:
                extra = args.cooldown_seconds + random.uniform(0, 8.0)
                print(f"  -- cooldown {extra:.0f}s after {i + 1} calls", flush=True)
                time.sleep(extra)

    if not to_fetch:
        if incremental_out:
            _write_output_file(final=True)
        else:
            enriched_at = _utc_now_iso()
            _merge_cache_into_records()
            if wrapper is not None:
                wrapper["sentiment_enriched_at"] = enriched_at
                wrapper["sentiment_source"] = "gemini"
                wrapper["news_classification_note"] = note
                out_obj: Any = wrapper
            else:
                out_obj = records
            out_path.parent.mkdir(parents=True, exist_ok=True)
            _atomic_write_json(out_path, out_obj)
            print(f"Wrote {out_path}", flush=True)
        print("Nothing left to classify (cache complete).", flush=True)
        return

    if incremental_out:
        _write_output_file(final=False)

    if workers > 1:
        print(
            f"  parallel workers={workers} (chunk별 순차·쿨다운 생략; 503↑ 가능)",
            flush=True,
        )
        io_lock = threading.Lock()
        done_holder = [0]

        def _run_chunk(chunk: list[str]) -> None:
            for i, k in enumerate(chunk):
                res = _classify_key_with_retries(k)
                with io_lock:
                    cache[k] = res
                    args.cache.write_text(
                        json.dumps(cache, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    done_holder[0] += 1
                    d = done_holder[0]
                    if incremental_out and d % write_every == 0:
                        _write_output_file(final=False)
                    if d % 25 == 0:
                        print(f"  ... {d}/{len(to_fetch)}", flush=True)
                if i + 1 < len(chunk) and args.sleep > 0:
                    time.sleep(
                        args.sleep + random.uniform(0, max(0.0, args.sleep_jitter))
                    )

        chunks = [to_fetch[i::workers] for i in range(workers)]
        chunks = [c for c in chunks if c]
        with ThreadPoolExecutor(max_workers=len(chunks)) as ex:
            futs = [ex.submit(_run_chunk, c) for c in chunks]
            for fut in futs:
                fut.result()
    else:
        for i, k in enumerate(to_fetch):
            result = _classify_key_with_retries(k)
            cache[k] = result
            args.cache.write_text(
                json.dumps(cache, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            if incremental_out and (i + 1) % write_every == 0:
                _write_output_file(final=False)
            if (i + 1) % 25 == 0:
                print(f"  ... {i + 1}/{len(to_fetch)}", flush=True)
            _pace_after_success(i)

    if incremental_out:
        _write_output_file(final=True)
    else:
        enriched_at = _utc_now_iso()
        _merge_cache_into_records()
        if wrapper is not None:
            wrapper["sentiment_enriched_at"] = enriched_at
            wrapper["sentiment_source"] = "gemini"
            wrapper["news_classification_note"] = note
            out_obj_done: Any = wrapper
        else:
            out_obj_done = records
        _atomic_write_json(out_path, out_obj_done)
        print(f"Wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
