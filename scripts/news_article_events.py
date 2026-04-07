"""
SomeDayNews `somedaynews_article_tickers.json` → **유료 기사**(빌드 기본)를 한 건씩 스트림으로 냄.

- `build_somedaynews_article_tickers.py` 기본은 **기사당 유효 6자리 종목 중 앞쪽 1개만** `stock_codes`에 넣음 (`--all-tickers`면 여러 개).
- `manifest`는 티커당 1행이어도 됨.
- **`published_at`**: API 필수. 비어 있으면 해당 기사 행은 스킵(가짜 시각 보강 없음).
- **`t0` / `date`**: `published_at`에서 뽑은 **KST 달력일**(`date` 필드는 빌드 산출물과 호환용).
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Iterator
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def is_six_digit_krx(code: str) -> bool:
    return isinstance(code, str) and len(code) == 6 and code.isdigit()


def default_articles_path(root: Path) -> Path:
    return root / "data" / "somedaynews_article_tickers.json"


def kst_calendar_date_from_published_at(published_at: str) -> date | None:
    """ISO published_at → KST 달력일."""
    s = published_at.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(KST).date()
    if len(s) >= 10:
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            return None
    return None


def article_row_kst_calendar_date(row: dict) -> date | None:
    """`published_at`만 사용. 없거나 파싱 실패면 None."""
    pa = row.get("published_at")
    if not isinstance(pa, str) or not pa.strip():
        return None
    return kst_calendar_date_from_published_at(pa)


def load_ticker_min_max_dates(
    articles_path: Path,
    *,
    article_date_from: date | None = None,
    article_date_to: date | None = None,
) -> dict[str, tuple[date, date]]:
    """
    종목코드 → (기사에 등장하는 KST 달력일 최소, 최대). `published_at` 있는 행만.

    article_date_from / article_date_to: 유료기사 **발행일(KST 달력일)**이 이 구간 안인 행만 포함(양끝 포함).
    """
    raw = json.loads(articles_path.read_text(encoding="utf-8"))
    acc: dict[str, list[date]] = defaultdict(list)
    for row in raw:
        d = article_row_kst_calendar_date(row)
        if d is None:
            continue
        if article_date_from is not None and d < article_date_from:
            continue
        if article_date_to is not None and d > article_date_to:
            continue
        for c in row.get("stock_codes") or []:
            code = str(c).strip()
            if not is_six_digit_krx(code):
                continue
            acc[code].append(d)
    return {k: (min(v), max(v)) for k, v in acc.items() if v}


def manifest_by_ticker(manifest_rows: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for m in manifest_rows:
        t = m.get("ticker")
        if isinstance(t, str):
            out[t] = m
    return out


def resolve_manifest_sources(
    out_dir: Path,
) -> tuple[dict[str, dict] | None, dict[tuple[int, str], dict] | None]:
    """
    EODHD 출력 루트(`data/eodhd_news_windows`) 기준 manifest 출처.

    - `per_article/manifest_per_article.json` 이 있고 비어 있지 않으면 **(None, (article_idx, ticker)→행)**.
    - 아니면 루트 `manifest.json` → **(ticker→행, None)**.
    - 둘 다 없거나 깨지면 **(None, None)**.
    """
    per_p = out_dir / "per_article" / "manifest_per_article.json"
    if per_p.is_file():
        try:
            rows = json.loads(per_p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            rows = []
        if isinstance(rows, list) and len(rows) > 0:
            idx: dict[tuple[int, str], dict] = {}
            for m in rows:
                ai = m.get("article_idx")
                t = m.get("ticker")
                if isinstance(ai, int) and isinstance(t, str):
                    idx[(ai, t)] = m
            if idx:
                return (None, idx)
    tick_p = out_dir / "manifest.json"
    if tick_p.is_file():
        try:
            rows = json.loads(tick_p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            rows = []
        if isinstance(rows, list) and len(rows) > 0:
            return (manifest_by_ticker(rows), None)
    return (None, None)


def iter_article_ticker_events(
    articles_path: Path,
    *,
    manifest_by_ticker: dict[str, dict] | None = None,
    per_article_by_key: dict[tuple[int, str], dict] | None = None,
    require_intraday: bool = True,
    require_eod: bool = False,
) -> Iterator[dict]:
    """
    Yields: article_idx, ticker, t0 (YYYY-MM-DD, KST), published_at (API), manifest_row.

    `manifest_by_ticker` 와 `per_article_by_key` 중 **정확히 하나**만 넘깁니다.
    `published_at` 없는 행은 건너뜀.
    """
    if (manifest_by_ticker is None) == (per_article_by_key is None):
        raise ValueError(
            "iter_article_ticker_events: manifest_by_ticker 와 per_article_by_key 중 하나만 지정하세요."
        )

    raw = json.loads(articles_path.read_text(encoding="utf-8"))
    for article_idx, row in enumerate(raw):
        pa = row.get("published_at")
        if not isinstance(pa, str) or not pa.strip():
            continue
        published_at = pa.strip()
        kst_d = article_row_kst_calendar_date(row)
        if kst_d is None:
            continue
        t0_str = kst_d.isoformat()
        for c in row.get("stock_codes") or []:
            code = str(c).strip()
            if not is_six_digit_krx(code):
                continue
            if per_article_by_key is not None:
                m = per_article_by_key.get((article_idx, code))
            else:
                m = manifest_by_ticker.get(code) if manifest_by_ticker else None
            if not m:
                continue
            if require_intraday and not m.get("intraday_ok"):
                continue
            if require_eod and not m.get("eod_ok"):
                continue
            yield {
                "article_idx": article_idx,
                "ticker": code,
                "t0": t0_str,
                "published_at": published_at,
                "manifest_row": m,
            }
