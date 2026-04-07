#!/usr/bin/env python3
"""
manifest 상 5분봉 파일이 비어 있는(intraday_ok 이지만 bars=[]) 티커를 여러 방식으로 재조회합니다.

시도 순서 (각 단계에서 봉이 생기면 중단):
  1) 5m + 10일 청크 + 반대 접미사 — 최초 수집은 주로 EOD 기준 접미사만 썼을 때 여기서 복구되는 경우가 많음
  2) 5m + 일 단위 청크 + 원래 접미사
  3) 5m + 일 단위 청크 + 반대 접미사
  4) 1m + 10일 청크 → 5m 집계 (원래 접미사)
  5) 1m + 10일 청크 → 5m 집계 (반대 접미사)

성공 시 intraday_5m/{ticker}.json 과 manifest.json 을 갱신합니다.

  python3 scripts/retry_empty_intraday_eodhd.py
  python3 scripts/retry_empty_intraday_eodhd.py --limit 5
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

# scripts/ 를 path 에 넣어 동일 모듈 import
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT / "scripts"))

import download_eodhd_news_windows as d  # noqa: E402


def load_empty_report(path: Path) -> list[dict]:
    if not path.is_file():
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def parse_ymd(s: str) -> date:
    return date.fromisoformat(str(s)[:10])


def opposite_suffix(suf: str) -> str:
    return "KQ" if suf == "KO" else "KO"


def recover_intraday(
    token: str,
    code: str,
    suffix: str,
    w_start: date,
    w_end: date,
    *,
    today: date,
    timeout: int,
    retries: int,
    delay: float,
) -> tuple[list[dict] | None, str | None, str | None]:
    """
    Returns (bars_or_none, suffix_used, method_tag).
    bars_or_none: None 이면 치명적 실패(404 등), [] 이면 조회는 됐으나 비어 있음.
    """
    end = min(w_end, today)
    if end < w_start:
        return [], suffix, None

    # (tag, interval, chunk_days, suffix: "primary" | "alt")
    attempts: list[tuple[str, str, int, str]] = [
        ("5m_c10_alt", "5m", 10, "alt"),
        ("5m_day", "5m", 1, "primary"),
        ("5m_day_alt", "5m", 1, "alt"),
        ("1m_agg", "1m", 10, "primary"),
        ("1m_agg_alt", "1m", 10, "alt"),
    ]

    alt = opposite_suffix(suffix)

    for tag, interval, chunk, suf_mode in attempts:
        use_suffix = alt if suf_mode == "alt" else suffix

        got = d.fetch_intraday_chunked(
            token,
            code,
            use_suffix,
            w_start,
            end,
            interval=interval,
            chunk_days=chunk,
            timeout=timeout,
            retries=retries,
            delay=delay,
        )
        if got is None:
            continue
        if interval == "1m":
            merged = d.aggregate_1m_to_5m(got)
            if len(merged) > 0:
                return merged, use_suffix, tag
        elif len(got) > 0:
            return got, use_suffix, tag

    return [], suffix, None


def main() -> None:
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="EODHD: 빈 5분봉 파일 재조회")
    parser.add_argument(
        "--empty-report",
        default=str(_ROOT / "data" / "analysis" / "intraday_empty_bars_tickers.json"),
        help="빈 bars 티커 목록 JSON",
    )
    parser.add_argument(
        "--out-dir",
        default=str(_ROOT / "data" / "eodhd_news_windows"),
        help="eodhd_news_windows 루트",
    )
    parser.add_argument("--limit", type=int, default=0, help="0이면 전체, N이면 앞에서 N개만")
    parser.add_argument(
        "--force",
        action="store_true",
        help="이미 bars가 있는 파일도 목록에 있으면 다시 시도",
    )
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument(
        "--token-file",
        default="",
        help="첫 비어 있지 않은 줄을 토큰으로 사용",
    )
    args = parser.parse_args()

    d.load_env_files(_ROOT)
    token = os.environ.get("EODHD_API_TOKEN") or os.environ.get("EOD_API_TOKEN")
    if args.token_file:
        tf = Path(args.token_file).expanduser().resolve()
        if tf.is_file():
            for line in tf.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    token = line
                    break
    if not token:
        print(
            "EODHD API 토큰이 필요합니다 (EODHD_API_TOKEN 또는 .env.local).",
            file=sys.stderr,
        )
        sys.exit(1)

    report = load_empty_report(Path(args.empty_report))
    if args.limit > 0:
        report = report[: args.limit]

    out = Path(args.out_dir)
    intra_dir = out / "intraday_5m"
    manifest_path = out / "manifest.json"
    log_path = out / "intraday_retry.log"
    intra_dir.mkdir(parents=True, exist_ok=True)

    manifest_by_ticker: dict[str, dict] = {}
    if manifest_path.is_file():
        try:
            for m in json.loads(manifest_path.read_text(encoding="utf-8")):
                t = m.get("ticker")
                if isinstance(t, str):
                    manifest_by_ticker[t] = m
        except json.JSONDecodeError:
            pass

    today = date.today()
    ok_n = 0
    still_empty = 0
    skipped_ok = 0

    with log_path.open("a", encoding="utf-8") as logf:
        for i, row in enumerate(report):
            code = row["ticker"]
            suffix = row.get("suffix") or "KO"
            w_start = parse_ymd(row["window_from"])
            w_end = parse_ymd(row["window_to"])
            intra_path = intra_dir / f"{code}.json"
            if not args.force and intra_path.is_file():
                try:
                    prev = json.loads(intra_path.read_text(encoding="utf-8"))
                    if len(prev.get("bars") or []) > 0:
                        skipped_ok += 1
                        continue
                except (json.JSONDecodeError, TypeError):
                    pass
            print(f"[{i + 1}/{len(report)}] {code}.{suffix} …", flush=True)

            bars, suf_used, method = recover_intraday(
                token,
                code,
                suffix,
                w_start,
                w_end,
                today=today,
                timeout=args.timeout,
                retries=args.retries,
                delay=args.delay,
            )

            line = f"{code}\t{suffix}\t"
            if bars is None:
                line += "fetch_none\n"
                logf.write(line)
                logf.flush()
                still_empty += 1
                continue

            if len(bars) == 0:
                line += "still_empty_after_all\n"
                logf.write(line)
                logf.flush()
                still_empty += 1
                continue

            payload = {
                "ticker": code,
                "suffix": suf_used,
                "t0": row["t0"],
                "from": row["window_from"],
                "to": row["window_to"],
                "interval": "5m",
                "bars": bars,
                "source_note": f"retry_empty_intraday:{method}",
            }
            intra_file = intra_dir / f"{code}.json"
            intra_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

            m = manifest_by_ticker.get(code, {})
            m["ticker"] = code
            m["intraday_ok"] = True
            m["intraday_rows"] = len(bars)
            m["suffix"] = suf_used
            m["intraday_retry_method"] = method
            manifest_by_ticker[code] = m

            manifest_path.write_text(
                json.dumps(
                    [manifest_by_ticker[k] for k in sorted(manifest_by_ticker)],
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )

            line += f"ok\t{method}\t{len(bars)}_bars\n"
            logf.write(line)
            logf.flush()
            ok_n += 1
            print(f"  → recovered {len(bars)} bars via {method}", flush=True)

    print(
        f"done: recovered={ok_n}, still_empty={still_empty}, "
        f"skipped_already_had_bars={skipped_ok}, log={log_path}"
    )


if __name__ == "__main__":
    main()
