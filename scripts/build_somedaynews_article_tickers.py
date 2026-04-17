#!/usr/bin/env python3
"""
`data/somedaynews/YYYYMMDD.json` (SomeDayNews API 응답)을 합쳐
`data/somedaynews_article_tickers.json`을 만듭니다.

- 종목(`stock_codes`에 6자리 숫자가 하나라도 있는 기사만). **기본: API 배열 순서상 첫 6자리 종목 1개만** (`--all-tickers`면 전부)
- **유료만**: API `is_paid === true`인 기사만(무료 제외). 전체를 쓰려면 `--include-free`
- `published_at`: API 필수(없으면 해당 기사는 건너뜀 — 보강 시각 없음)
- `free_conversion_at`: API에 있으면 저장(무료 전환 시각; 없으면 null)
- `date`: `published_at`의 KST 달력일
- `--date-from` / `--date-to`: 위 KST 달력일 구간만 포함(양끝 포함). 비우면 전체 일별 JSON에서 집계

  python3 scripts/build_somedaynews_article_tickers.py
  python3 scripts/build_somedaynews_article_tickers.py --date-from 2025-01-01 --date-to 2026-03-31
  python3 scripts/build_somedaynews_article_tickers.py --somedaynews-dir data/somedaynews --out data/somedaynews_article_tickers.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from news_article_events import is_six_digit_krx, kst_calendar_date_from_published_at


def parse_iso_date_opt(s: str) -> date | None:
    t = (s or "").strip()
    if not t:
        return None
    return date.fromisoformat(t[:10])


def norm_stock_codes(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for c in raw:
        code = str(c).strip()
        if is_six_digit_krx(code):
            out.append(code)
    return out


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="SomeDayNews 일별 JSON → article_tickers.json")
    parser.add_argument("--somedaynews-dir", default=str(root / "data" / "somedaynews"))
    parser.add_argument("--out", default=str(root / "data" / "somedaynews_article_tickers.json"))
    parser.add_argument(
        "--include-free",
        action="store_true",
        help="무료 기사(is_paid=false)까지 포함 (기본: 유료만)",
    )
    parser.add_argument(
        "--date-from",
        default="",
        metavar="YYYY-MM-DD",
        help="published_at→KST 달력일 하한(포함). 비우면 제한 없음",
    )
    parser.add_argument(
        "--date-to",
        default="",
        metavar="YYYY-MM-DD",
        help="published_at→KST 달력일 상한(포함). 비우면 제한 없음",
    )
    parser.add_argument(
        "--all-tickers",
        action="store_true",
        help="기사에 붙은 6자리 종목 전부 유지 (기본: 앞쪽 1개만)",
    )
    args = parser.parse_args()

    indir = Path(args.somedaynews_dir)
    out_path = Path(args.out)
    if not indir.is_dir():
        print(f"디렉터리 없음: {indir}", file=sys.stderr)
        sys.exit(1)

    d_from = parse_iso_date_opt(args.date_from)
    d_to = parse_iso_date_opt(args.date_to)
    if d_from is not None and d_to is not None and d_to < d_from:
        print("--date-to 가 --date-from 보다 이릅니다.", file=sys.stderr)
        sys.exit(1)

    rows: list[dict] = []
    for path in sorted(indir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"건너뜀 {path.name}: {e}", file=sys.stderr)
            continue
        arts = data.get("articles")
        if not isinstance(arts, list):
            continue
        for a in arts:
            if not isinstance(a, dict):
                continue
            if not args.include_free and a.get("is_paid") is not True:
                continue
            codes = norm_stock_codes(a.get("stock_codes"))
            if not codes:
                continue
            if not args.all_tickers:
                codes = codes[:1]
            pa = a.get("published_at")
            if not isinstance(pa, str) or not pa.strip():
                continue
            published_at = pa.strip()
            kd = kst_calendar_date_from_published_at(published_at)
            if kd is None:
                continue
            if d_from is not None and kd < d_from:
                continue
            if d_to is not None and kd > d_to:
                continue
            d_cal = kd.isoformat()
            rd = a.get("registered_date")
            rec: dict = {
                "date": d_cal,
                "published_at": published_at,
                "article_id": a.get("article_id"),
                "title": (a.get("title") or "")[:500],
                "stock_codes": codes,
            }
            if isinstance(rd, str) and rd.strip():
                rec["registered_date"] = rd.strip()
            fca = a.get("free_conversion_at")
            if isinstance(fca, str) and fca.strip():
                rec["free_conversion_at"] = fca.strip()
            elif "free_conversion_at" in a:
                rec["free_conversion_at"] = None
            rows.append(rec)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    tick_note = "종목 앞 1개만" if not args.all_tickers else "종목 전부"
    scope = (
        f"유료·{tick_note}"
        if not args.include_free
        else f"무료 포함·{tick_note}"
    )
    filt = ""
    if d_from or d_to:
        filt = f", KST일 {d_from or '…'} ~ {d_to or '…'}"
    print(f"저장 {out_path} ({len(rows)}건, {scope}{filt})")


if __name__ == "__main__":
    main()
