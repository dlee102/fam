#!/usr/bin/env python3
"""
SomeDayNews 유료기사 JSON에서 EODHD 일봉(EOD) + 인트라데이를 내려받습니다.

**기사(발행일 KST)×종목**마다, 그 발행일 기준 ±before/after 달력 윈도로 저장합니다.
**같은 종목·같은 윈도**(같은 날 여러 기사)는 EOD·인트라를 **API 한 번** 받아 기사별 JSON만 복제합니다.
그 외 동일 (티커, 윈도)는 실행 중 메모리 캐시로도 중복 호출을 줄입니다.

  EODHD_API_TOKEN=... python3 scripts/download_eodhd_news_windows.py
  EODHD_API_TOKEN=... python3 scripts/download_eodhd_news_windows.py \\
    --article-from 2024-01-01 --article-to 2026-03-31 --force

입력 기본: data/somedaynews_article_tickers.json (`published_at` → KST 달력일)
출력: `per_article/manifest_per_article.json`, `per_article/eod/`, `per_article/intraday_{interval}/`

6자리 숫자 종목코드만 처리합니다 (.KO → 실패 시 .KQ).
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from news_article_events import (
    article_row_kst_calendar_date,
    is_six_digit_krx,
)

BASE = "https://eodhd.com/api"


def load_env_files(root: Path) -> None:
    """루트의 .env.local / .env 를 읽어, 비어 있지 않은 키만 os.environ 에 채웁니다."""
    for name in (".env.local", ".env"):
        path = root / name
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and val and key not in os.environ:
                os.environ[key] = val


def cached_payload_date_range(path: Path) -> tuple[date, date] | None:
    """캐시된 eod/intraday JSON의 from·to(달력일). 없거나 파싱 실패면 None."""
    if not path.is_file():
        return None
    try:
        j = json.loads(path.read_text(encoding="utf-8"))
        f = j.get("from")
        t = j.get("to")
        if not f or not t:
            return None
        return date.fromisoformat(str(f)[:10]), date.fromisoformat(str(t)[:10])
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


def ymd(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def parse_optional_article_date(s: str) -> date | None:
    """빈 문자열이면 None. YYYY-MM-DD."""
    t = (s or "").strip()
    if not t:
        return None
    return date.fromisoformat(t[:10])


def fetch_json(url: str, *, timeout: int, retries: int, base_delay: float) -> object | None:
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = Request(
                url,
                headers={"User-Agent": "fam-eodhd-downloader/1.0"},
                method="GET",
            )
            with urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
            if not body or body == "[]":
                return json.loads(body) if body else []
            return json.loads(body)
        except HTTPError as e:
            last_err = e
            if e.code == 404:
                return None
            if e.code == 429 or (500 <= e.code < 600):
                wait = base_delay * (2**attempt) + random.uniform(0, 0.4)
                time.sleep(wait)
                last = e
                continue
            raise
        except (URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            last = e
            wait = base_delay * (2**attempt) + random.uniform(0, 0.4)
            time.sleep(wait)
            continue
    if last:
        raise last
    return None


def build_url(path: str, params: dict[str, str]) -> str:
    return f"{BASE}/{path}?{urlencode(params)}"


def resolve_exchange_suffix(
    token: str,
    code: str,
    probe_from: date,
    probe_to: date,
    *,
    timeout: int,
    retries: int,
    delay: float,
) -> str | None:
    """KO 먼저, 404면 KQ. 둘 다 404면 None. (빈 리스트는 해당 접미사 채택)"""
    params_base = {
        "api_token": token,
        "from": ymd(probe_from),
        "to": ymd(probe_to),
        "fmt": "json",
    }
    last_list_suffix: str | None = None
    for suf in ("KO", "KQ"):
        sym = f"{code}.{suf}"
        url = build_url(f"eod/{sym}", params_base)
        data = fetch_json(url, timeout=timeout, retries=retries, base_delay=delay)
        time.sleep(delay)
        if data is None:
            continue
        if isinstance(data, list) and len(data) > 0:
            return suf
        if isinstance(data, list) and last_list_suffix is None:
            last_list_suffix = suf
    return last_list_suffix


def fetch_eod_range(
    token: str,
    code: str,
    suffix: str,
    start: date,
    end: date,
    *,
    timeout: int,
    retries: int,
    delay: float,
) -> list[dict] | None:
    sym = f"{code}.{suffix}"
    url = build_url(
        f"eod/{sym}",
        {
            "api_token": token,
            "from": ymd(start),
            "to": ymd(end),
            "fmt": "json",
        },
    )
    data = fetch_json(url, timeout=timeout, retries=retries, base_delay=delay)
    time.sleep(delay)
    if data is None:
        return None
    return data if isinstance(data, list) else []


def date_start_utc_ts(d: date) -> int:
    return int(datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp())


def date_end_utc_ts(d: date) -> int:
    return int(
        datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc).timestamp()
    )


def fetch_intraday_chunked(
    token: str,
    code: str,
    suffix: str,
    start: date,
    end: date,
    *,
    interval: str,
    chunk_days: int,
    timeout: int,
    retries: int,
    delay: float,
) -> list[dict] | None:
    sym = f"{code}.{suffix}"
    all_rows: list[dict] = []
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=chunk_days - 1), end)
        params = {
            "api_token": token,
            "interval": interval,
            "from": str(date_start_utc_ts(cur)),
            "to": str(date_end_utc_ts(chunk_end)),
            "fmt": "json",
        }
        url = build_url(f"intraday/{sym}", params)
        data = fetch_json(url, timeout=timeout, retries=retries, base_delay=delay)
        time.sleep(delay)
        if data is None:
            return None
        if isinstance(data, list):
            all_rows.extend(data)
        cur = chunk_end + timedelta(days=1)

    by_ts: dict[int, dict] = {}
    for row in all_rows:
        ts = row.get("timestamp")
        if ts is not None:
            by_ts[int(ts)] = row
    merged = [by_ts[k] for k in sorted(by_ts)]
    return merged


def fetch_intraday_interval_chunked(
    token: str,
    code: str,
    suffix: str,
    start: date,
    end: date,
    *,
    interval: str,
    chunk_days: int,
    timeout: int,
    retries: int,
    delay: float,
) -> list[dict] | None:
    return fetch_intraday_chunked(
        token,
        code,
        suffix,
        start,
        end,
        interval=interval,
        chunk_days=chunk_days,
        timeout=timeout,
        retries=retries,
        delay=delay,
    )


def fetch_intraday_5m_chunked(
    token: str,
    code: str,
    suffix: str,
    start: date,
    end: date,
    *,
    chunk_days: int,
    timeout: int,
    retries: int,
    delay: float,
) -> list[dict] | None:
    return fetch_intraday_interval_chunked(
        token,
        code,
        suffix,
        start,
        end,
        interval="5m",
        chunk_days=chunk_days,
        timeout=timeout,
        retries=retries,
        delay=delay,
    )


def iter_article_ticker_event_windows(
    articles_path: Path,
    before: int,
    after: int,
    *,
    article_date_from: date | None = None,
    article_date_to: date | None = None,
) -> list[tuple[int, str, str, str, date, date, date]]:
    """
    기사 행 × 종목마다 (article_idx, article_id, ticker, published_at, t0_kst, w_start, w_end).

    윈도는 **해당 기사의 발행일(KST 달력일)** 기준 ±before/after 달력일.
    article_date_from/to 가 있으면 발행일(KST)이 그 안에 있는 기사만.
    """
    raw = json.loads(articles_path.read_text(encoding="utf-8"))
    out: list[tuple[int, str, str, str, date, date, date]] = []
    for article_idx, row in enumerate(raw):
        pa = row.get("published_at")
        if not isinstance(pa, str) or not pa.strip():
            continue
        published_at = pa.strip()
        kst_d = article_row_kst_calendar_date(row)
        if kst_d is None:
            continue
        if article_date_from is not None and kst_d < article_date_from:
            continue
        if article_date_to is not None and kst_d > article_date_to:
            continue
        aid = row.get("article_id")
        aid_str = str(aid) if aid is not None else str(article_idx)
        w_start = kst_d - timedelta(days=before)
        w_end = kst_d + timedelta(days=after)
        for c in row.get("stock_codes") or []:
            code = str(c).strip()
            if not is_six_digit_krx(code):
                continue
            out.append((article_idx, aid_str, code, published_at, kst_d, w_start, w_end))
    return out


def aggregate_1m_to_5m(rows: list[dict]) -> list[dict]:
    """1분봉을 5분 버킷(UTC 기준 300초)으로 합쳐 5분봉 형식으로 만듭니다."""
    if not rows:
        return []
    by_ts: dict[int, dict] = {}
    for row in rows:
        ts = row.get("timestamp")
        if ts is not None:
            by_ts[int(ts)] = row
    sorted_rows = [by_ts[k] for k in sorted(by_ts)]
    buckets: dict[int, list[dict]] = {}
    for row in sorted_rows:
        ts = int(row["timestamp"])
        bstart = ts - (ts % 300)
        buckets.setdefault(bstart, []).append(row)
    def _round_num(v: object) -> float | int:
        x = float(v)  # type: ignore[arg-type]
        return int(x) if x.is_integer() else x

    out: list[dict] = []
    for bstart in sorted(buckets):
        pts = buckets[bstart]
        o = pts[0]["open"]
        h = max(float(x["high"]) for x in pts)
        l = min(float(x["low"]) for x in pts)
        c = pts[-1]["close"]
        vol = sum(float(x.get("volume") or 0) for x in pts)
        out.append(
            {
                "timestamp": bstart,
                "gmtoffset": pts[0].get("gmtoffset", 0),
                "datetime": pts[0].get("datetime", ""),
                "open": _round_num(o),
                "high": _round_num(h),
                "low": _round_num(l),
                "close": _round_num(c),
                "volume": _round_num(vol),
            }
        )
    return out


def run_article_event_download(
    args: argparse.Namespace,
    token: str,
    articles_path: Path,
    *,
    article_date_from: date | None = None,
    article_date_to: date | None = None,
) -> None:
    """유료기사 발행일(KST)×종목마다 ±before/after 윈도로 EOD+인트라 저장. 동일 (티커, 윈도)는 API 응답 캐시."""
    interval = args.interval.strip()
    if not interval or any(c in interval for c in ("/", "\\", "..")):
        print(f"잘못된 --interval: {args.interval!r}", file=sys.stderr)
        sys.exit(1)
    if args.chunk_days > 0:
        chunk_days_default = args.chunk_days
    else:
        # 5m: ~±30일 윈도면 청크 크게 잡아 intraday HTTP 왕복 감소 (API 한도 내에서 --delay 조절)
        chunk_days_default = 30 if "h" in interval.lower() else 15

    out = Path(args.out_dir)
    per_root = out / "per_article"
    eod_dir = per_root / "eod"
    intra_dir = per_root / f"intraday_{interval}"
    eod_dir.mkdir(parents=True, exist_ok=True)
    intra_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = per_root / "manifest_per_article.json"
    err_path = per_root / "errors.log"

    def append_err(line: str) -> None:
        with err_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    events = iter_article_ticker_event_windows(
        articles_path,
        args.before,
        args.after,
        article_date_from=article_date_from,
        article_date_to=article_date_to,
    )
    if args.limit > 0:
        events = events[: args.limit]

    if not events:
        print(
            "필터 후 대상 이벤트 없음 (--article-from/--article-to 확인)",
            file=sys.stderr,
        )
        sys.exit(1)

    today = date.today()
    use_cache = not args.force
    suffix_cache: dict[str, str | None] = {}
    eod_cache: dict[tuple[str, str, date, date], list | None] = {}
    intra_cache: dict[tuple[str, str, date, date, str], list | None] = {}

    total = len(events)
    filt = f" 발행일(KST) 필터: {article_date_from} ~ {article_date_to}" if (
        article_date_from or article_date_to
    ) else ""

    groups: dict[tuple[str, date, date], list[int]] = defaultdict(list)
    for i, ev in enumerate(events):
        code_i = ev[2]
        w_s, w_e = ev[5], ev[6]
        w_cap = min(w_e, today)
        groups[(code_i, w_s, w_cap)].append(i)

    sorted_gks = sorted(groups.keys(), key=lambda g: (g[0], g[1], g[2]))
    ngroups = len(sorted_gks)

    print(
        f"다운로드 대상: {total}건 (기사×종목), "
        f"고유 (티커×윈도) {ngroups}건 — 같은 종목·같은 발행일 윈도는 API 1회로 묶음.{filt}",
        flush=True,
    )
    (out / "download_meta.json").write_text(
        json.dumps(
            {
                "mode": "article_x_ticker",
                "article_date_from": ymd(article_date_from) if article_date_from else None,
                "article_date_to": ymd(article_date_to) if article_date_to else None,
                "n_events": total,
                "n_unique_ticker_windows": ngroups,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    rows_by_idx: list[dict | None] = [None] * total

    def write_manifest_sorted() -> None:
        done = [r for r in rows_by_idx if r is not None]
        done.sort(key=lambda r: (int(r["article_idx"]), str(r["ticker"])))
        manifest_path.write_text(
            json.dumps(done, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    for gn, gk in enumerate(sorted_gks):
        indices = sorted(groups[gk])
        code, w_start, w_end_cap = gk
        i0 = indices[0]
        _, _, _, _pa0, kst_d0, _, _w_end0 = events[i0]
        probe_from = max(w_start, kst_d0 - timedelta(days=7))
        probe_to = max(w_end_cap, probe_from)

        print(
            f"[그룹 {gn + 1}/{ngroups}] {code} {ymd(w_start)}~{ymd(w_end_cap)} "
            f"({len(indices)}건)",
            flush=True,
        )

        if code not in suffix_cache:
            suffix_cache[code] = resolve_exchange_suffix(
                token,
                code,
                probe_from,
                probe_to,
                timeout=args.timeout,
                retries=args.retries,
                delay=args.delay,
            )
        suffix = suffix_cache[code]

        if suffix is None:
            for i in indices:
                article_idx, aid, code_i, published_at, kst_d, w_s, w_e = events[i]
                base_name = f"{article_idx:05d}_{code_i}"
                eod_file = eod_dir / f"{base_name}.json"
                intra_file = intra_dir / f"{base_name}.json"
                row = {
                    "article_idx": article_idx,
                    "article_id": aid,
                    "ticker": code_i,
                    "published_at": published_at,
                    "t0_kst": ymd(kst_d),
                    "window_from": ymd(w_s),
                    "window_to": ymd(w_e),
                    "suffix": None,
                    "eod_ok": False,
                    "intraday_ok": False,
                    "eod_path": str(eod_file.relative_to(out)),
                    "intraday_path": str(intra_file.relative_to(out)),
                    "error": "404_KO_KQ_or_empty",
                }
                append_err(f"{article_idx}\t{code_i}\t{published_at}\tno_suffix")
                rows_by_idx[i] = row
            write_manifest_sorted()
            continue

        eod_key = (code, suffix, w_start, w_end_cap)
        intra_key = (code, suffix, w_start, w_end_cap, interval)

        need_eod_fetch = False
        if not args.skip_eod:
            for i in indices:
                article_idx, aid, code_i, published_at, kst_d, w_s, w_e = events[i]
                eod_file = eod_dir / f"{article_idx:05d}_{code_i}.json"
                if args.force or not eod_file.is_file():
                    need_eod_fetch = True
                    break
                cr = cached_payload_date_range(eod_file)
                if cr and not args.force and (w_start < cr[0] or w_end_cap > cr[1]):
                    need_eod_fetch = True
                    break

        eod_fetched: list | None = None
        if not args.skip_eod and need_eod_fetch:
            if use_cache and eod_key in eod_cache:
                eod_fetched = eod_cache[eod_key]
            else:
                eod_fetched = fetch_eod_range(
                    token,
                    code,
                    suffix,
                    w_start,
                    w_end_cap,
                    timeout=args.timeout,
                    retries=args.retries,
                    delay=args.delay,
                )
            if use_cache and eod_fetched is not None:
                eod_cache[eod_key] = eod_fetched

        need_intra_fetch = False
        if not args.skip_intraday:
            for i in indices:
                article_idx, aid, code_i, published_at, kst_d, w_s, w_e = events[i]
                intra_file = intra_dir / f"{article_idx:05d}_{code_i}.json"
                if args.force or not intra_file.is_file():
                    need_intra_fetch = True
                    break
                cr_i = cached_payload_date_range(intra_file)
                if cr_i and not args.force and (w_start < cr_i[0] or w_end_cap > cr_i[1]):
                    need_intra_fetch = True
                    break

        bars: list | None = None
        intra_suffix = suffix
        intra_alt_used: str | None = None
        if not args.skip_intraday and need_intra_fetch:
            if use_cache and intra_key in intra_cache:
                bars = intra_cache[intra_key]
            else:
                bars = fetch_intraday_interval_chunked(
                    token,
                    code,
                    suffix,
                    w_start,
                    w_end_cap,
                    interval=interval,
                    chunk_days=max(1, chunk_days_default),
                    timeout=args.timeout,
                    retries=args.retries,
                    delay=args.delay,
                )
            if bars is not None and len(bars) == 0:
                alt = "KQ" if suffix == "KO" else "KO"
                alt_key = (code, alt, w_start, w_end_cap, interval)
                bars_alt: list | None
                if use_cache and alt_key in intra_cache:
                    bars_alt = intra_cache[alt_key]
                else:
                    bars_alt = fetch_intraday_interval_chunked(
                        token,
                        code,
                        alt,
                        w_start,
                        w_end_cap,
                        interval=interval,
                        chunk_days=max(1, chunk_days_default),
                        timeout=args.timeout,
                        retries=args.retries,
                        delay=args.delay,
                    )
                if use_cache and bars_alt is not None:
                    intra_cache[alt_key] = bars_alt
                if bars_alt is not None and len(bars_alt) > 0:
                    bars = bars_alt
                    intra_suffix = alt
                    intra_alt_used = alt
            if use_cache and bars is not None:
                intra_cache[intra_key] = bars

        for i in indices:
            article_idx, aid, code_i, published_at, kst_d, w_s, w_e = events[i]
            base_name = f"{article_idx:05d}_{code_i}"
            eod_file = eod_dir / f"{base_name}.json"
            intra_file = intra_dir / f"{base_name}.json"

            row: dict = {
                "article_idx": article_idx,
                "article_id": aid,
                "ticker": code_i,
                "published_at": published_at,
                "t0_kst": ymd(kst_d),
                "window_from": ymd(w_s),
                "window_to": ymd(w_e),
                "suffix": suffix,
                "eod_ok": False,
                "intraday_ok": False,
                "eod_path": str(eod_file.relative_to(out)),
                "intraday_path": str(intra_file.relative_to(out)),
            }
            if intra_alt_used:
                row["intraday_alt_suffix"] = intra_alt_used

            if not args.skip_eod:
                if need_eod_fetch:
                    if eod_fetched is None:
                        row["eod_error"] = "eod_fetch_failed"
                        append_err(f"{article_idx}\t{code_i}\t{published_at}\teod_failed")
                    else:
                        payload = {
                            "article_idx": article_idx,
                            "article_id": aid,
                            "ticker": code_i,
                            "published_at": published_at,
                            "t0_kst": ymd(kst_d),
                            "suffix": suffix,
                            "from": ymd(w_start),
                            "to": ymd(w_e),
                            "bars": eod_fetched,
                        }
                        eod_file.write_text(
                            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
                        )
                        row["eod_ok"] = True
                        row["eod_rows"] = len(eod_fetched)
                elif eod_file.is_file():
                    row["eod_ok"] = True
                    try:
                        row["eod_rows"] = len(
                            json.loads(eod_file.read_text(encoding="utf-8")).get("bars") or []
                        )
                    except (json.JSONDecodeError, TypeError):
                        pass

            if not args.skip_intraday:
                if need_intra_fetch:
                    if bars is None:
                        row["intraday_error"] = "intraday_fetch_failed"
                        append_err(f"{article_idx}\t{code_i}\t{published_at}\tintraday_failed")
                    else:
                        payload = {
                            "article_idx": article_idx,
                            "article_id": aid,
                            "ticker": code_i,
                            "published_at": published_at,
                            "t0_kst": ymd(kst_d),
                            "suffix": intra_suffix,
                            "from": ymd(w_start),
                            "to": ymd(w_e),
                            "interval": interval,
                            "bars": bars,
                        }
                        intra_file.write_text(
                            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
                        )
                        row["intraday_ok"] = True
                        row["intraday_rows"] = len(bars)
                elif intra_file.is_file():
                    row["intraday_ok"] = True

            rows_by_idx[i] = row

        write_manifest_sorted()

    n_manifest = sum(1 for r in rows_by_idx if r is not None)
    print(f"기록 완료: {manifest_path} ({n_manifest}행)", flush=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="EODHD: 유료기사(발행일 KST)×종목별 ±before/after EOD+인트라데이"
    )
    parser.add_argument(
        "--articles",
        default=str(root / "data" / "somedaynews_article_tickers.json"),
        help="기사별 date, stock_codes JSON",
    )
    parser.add_argument(
        "--out-dir",
        default=str(root / "data" / "eodhd_news_windows"),
        help="출력 루트",
    )
    parser.add_argument("--before", type=int, default=30, help="t0 이전 거래일 아님, 달력일")
    parser.add_argument("--after", type=int, default=30, help="t0 이후 달력일")
    parser.add_argument(
        "--delay",
        type=float,
        default=0.35,
        help="요청 간 대기(초). 낮추면 빠르지만 429 위험 (예: 0.15~0.25 실험)",
    )
    parser.add_argument("--timeout", type=int, default=120, help="HTTP 타임아웃")
    parser.add_argument("--retries", type=int, default=4, help="일시 오류 재시도")
    parser.add_argument(
        "--interval",
        type=str,
        default="5m",
        metavar="INT",
        help="인트라데이 간격 (EODHD intraday API). 예: 5m, 1h. 출력 폴더는 intraday_{interval}",
    )
    parser.add_argument(
        "--chunk-days",
        type=int,
        default=0,
        help="인트라데이 구간 분할(달력일). 0이면 interval별 기본값(5m=15, 1h=30)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="0=전체. N>0이면 기사×종목 이벤트 상위 N건만 (테스트용)",
    )
    parser.add_argument("--skip-intraday", action="store_true", help="EOD만")
    parser.add_argument("--skip-eod", action="store_true", help="인트라데이만 (EOD 스킵)")
    parser.add_argument("--force", action="store_true", help="이미 있어도 다시 받기")
    parser.add_argument(
        "--token-file",
        default="",
        help="파일 첫 비어 있지 않은 줄을 API 토큰으로 사용 (환경변수보다 우선)",
    )
    parser.add_argument(
        "--article-from",
        default="",
        metavar="YYYY-MM-DD",
        help="유료기사 published_at→KST 달력일 하한(포함). 빈 값이면 제한 없음",
    )
    parser.add_argument(
        "--article-to",
        default="",
        metavar="YYYY-MM-DD",
        help="유료기사 published_at→KST 달력일 상한(포함). 빈 값이면 제한 없음",
    )
    args = parser.parse_args()

    load_env_files(root)
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
            "EODHD API 토큰이 필요합니다. 다음 중 하나: "
            "환경변수 EODHD_API_TOKEN, 프로젝트 루트 .env.local, 또는 --token-file",
            file=sys.stderr,
        )
        sys.exit(1)

    articles_path = Path(args.articles)
    if not articles_path.is_file():
        print(f"파일 없음: {articles_path}", file=sys.stderr)
        sys.exit(1)

    article_date_from = parse_optional_article_date(args.article_from)
    article_date_to = parse_optional_article_date(args.article_to)
    if article_date_from and article_date_to and article_date_from > article_date_to:
        print("--article-from 이 --article-to 보다 늦을 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    run_article_event_download(
        args,
        token,
        articles_path,
        article_date_from=article_date_from,
        article_date_to=article_date_to,
    )


if __name__ == "__main__":
    main()
