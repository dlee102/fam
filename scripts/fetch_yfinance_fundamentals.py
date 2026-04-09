#!/usr/bin/env python3
"""
기사(news_tickers.json)의 대표 종목에 대해 yfinance로 스냅샷(요약 info + 재무표) 저장.

  python3 scripts/fetch_yfinance_fundamentals.py
  python3 scripts/fetch_yfinance_fundamentals.py --news-id 02000806645317064
  python3 scripts/fetch_yfinance_fundamentals.py --tickers 005930,000660
  python3 scripts/fetch_yfinance_fundamentals.py --all-unique
  python3 scripts/fetch_yfinance_fundamentals.py --all-unique --sleep 0.35

출력: data/yfinance_fundamentals/<timestamp>_<newsId|manual|all_unique>/
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS_TICKERS_JSON = ROOT / "data" / "news_tickers.json"


def load_news_tickers() -> dict:
    if not NEWS_TICKERS_JSON.exists():
        print(f"없음: {NEWS_TICKERS_JSON}", file=sys.stderr)
        sys.exit(1)
    with open(NEWS_TICKERS_JSON, encoding="utf-8") as f:
        return json.load(f)


def krx_codes_to_yahoo_candidates(code: str) -> list[str]:
    c = re.sub(r"\D", "", code).zfill(6)
    if len(c) != 6:
        return []
    return [f"{c}.KS", f"{c}.KQ"]


def resolve_yahoo_symbol(code: str, yf_mod):
    """6자리 KRX → .KS/.KQ, 그 외(예: AZN, LLY)는 야후 심볼 그대로 시도."""
    raw = str(code).strip()
    if not raw or raw == "비상장":
        return None, []

    if re.fullmatch(r"\d{1,6}", raw):
        candidates = krx_codes_to_yahoo_candidates(raw)
        if not candidates:
            return None, []
        tried = []
        for sym in candidates:
            tried.append(sym)
            t = yf_mod.Ticker(sym)
            info = t.info or {}
            if info.get("symbol") or info.get("longName") or info.get("shortName"):
                return sym, tried
        return candidates[0], tried

    sym = re.sub(r"\s+", "", raw).upper()
    tried = [sym]
    t = yf_mod.Ticker(sym)
    info = t.info or {}
    if info.get("symbol") or info.get("longName") or info.get("shortName"):
        return sym, tried
    return sym, tried


def fetch_bundle_for_codes(
    codes: list[str],
    label: str,
    out_dir: Path,
    yf_mod,
    sleep_s: float,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    bundle = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "label": label,
        "krx_codes": codes,
        "tickers": [],
    }
    n = len(codes)
    for i, code in enumerate(codes, 1):
        ysym, tried = resolve_yahoo_symbol(code, yf_mod)
        row = {"krx_code": code, "tried_yahoo": tried, "resolved_yahoo": ysym}
        if not ysym:
            row["error"] = "skip or unknown format"
            bundle["tickers"].append(row)
            print(f"  [{i}/{n}] {code} → (건너뜀)")
            if sleep_s > 0:
                time.sleep(sleep_s)
            continue
        try:
            row["data"] = fetch_one(ysym, yf_mod)
        except Exception as e:
            row["error"] = str(e)
        bundle["tickers"].append(row)
        name = row.get("data", {}).get("info", {}).get("longName") or row.get("data", {}).get("info", {}).get("shortName")
        print(f"  [{i}/{n}] {code} → {ysym}  {(name or '')[:50]}")
        if sleep_s > 0 and i < n:
            time.sleep(sleep_s)

    out_json = out_dir / "fundamentals.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2, default=str)
    return out_json


def fetch_one(sym: str, yf_mod) -> dict:
    t = yf_mod.Ticker(sym)
    info = dict(t.info) if t.info else {}
    out: dict = {"yahoo_symbol": sym, "info": info, "tables": {}}
    for name, getter in (
        ("financials", lambda: t.financials),
        ("balance_sheet", lambda: t.balance_sheet),
        ("cashflow", lambda: t.cashflow),
        ("quarterly_financials", lambda: t.quarterly_financials),
    ):
        try:
            df = getter()
            if df is not None and not df.empty:
                out["tables"][name] = json.loads(df.to_json(date_format="iso"))
        except Exception as e:
            out["tables"][name] = {"_error": str(e)}
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="yfinance 펀더멘탈 스냅샷 (news_tickers 연동)")
    parser.add_argument("--news-id", help="news_tickers.json의 newsId")
    parser.add_argument("--tickers", help="쉼표 구분 6자리 코드 (예: 005930,000660)")
    parser.add_argument(
        "--all-unique",
        action="store_true",
        help="news_tickers.json의 unique_tickers 전부 순회 저장",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.25,
        help="종목 간 대기(초), Yahoo 과호출 완화 (기본 0.25)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="출력 디렉터리 (기본: data/yfinance_fundamentals/… 자동)",
    )
    args = parser.parse_args()

    try:
        import yfinance as yf
    except ImportError:
        print("yfinance 미설치: pip install yfinance", file=sys.stderr)
        sys.exit(1)

    codes: list[str] = []
    label = "manual"
    if args.tickers:
        codes = [c.strip() for c in args.tickers.split(",") if c.strip()]
        label = "manual"
    elif args.all_unique:
        data = load_news_tickers()
        seen: set[str] = set()
        for c in data.get("unique_tickers") or []:
            s = str(c).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            codes.append(s)
        label = "all_unique"
        print(f"unique_tickers {len(codes)}개 일괄 수집 (--sleep {args.sleep}s)")
    elif args.news_id:
        data = load_news_tickers()
        art = next((a for a in data.get("articles", []) if a.get("newsId") == args.news_id), None)
        if not art:
            print(f"newsId 없음: {args.news_id}", file=sys.stderr)
            sys.exit(1)
        codes = art.get("tickers") or []
        label = args.news_id
        print(f"기사: {art.get('title', '')[:80]}…")
    else:
        data = load_news_tickers()
        arts = data.get("articles") or []
        if not arts:
            print("articles 비어 있음", file=sys.stderr)
            sys.exit(1)
        art = arts[0]
        codes = art.get("tickers") or []
        label = art.get("newsId", "first")
        print(f"(첫 기사) {art.get('title', '')[:80]}…")

    if not codes:
        print("조회할 티커 없음", file=sys.stderr)
        sys.exit(1)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = args.out or (ROOT / "data" / "yfinance_fundamentals" / f"{ts}_{label}")
    out_json = fetch_bundle_for_codes(codes, label, out_dir, yf, args.sleep)
    print(f"저장: {out_json}")


if __name__ == "__main__":
    main()
