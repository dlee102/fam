#!/usr/bin/env python3
"""
무료 전환 직후 첫 진입(전환 시각 이후 첫 장중 5분봉 종가) 기준으로
거래일 +1, +2, +3일째 장 마지막 5분봉 종가까지 홀딩 수익률 그리드.

- 거래일: 5분봉 시각을 KST 달력일로 묶은 유일한 날짜를 오름차순.
- 진입일 = 진입 봉이 속한 KST 거래일.
- N일 홀딩: 진입일이 거래일 목록에서 idx일 때, 청산일 = 목록[idx + N - 1] 장 마지막 봉 종가.

  python3 scripts/analyze_after_free_hold_grid.py
"""
from __future__ import annotations

import json
import statistics
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from news_article_events import (  # noqa: E402
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
import analyze_10m_return_path as a10  # noqa: E402

OUT_DIR = ROOT / "data" / "eodhd_news_windows"
ARTICLES = default_articles_path(ROOT)
HOLD_GRID = (1, 2, 3)


def load_article_rows() -> list[dict]:
    raw = json.loads(ARTICLES.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else []


def bar_kst_date(dt_str: str) -> date:
    u = a10.bar_start_utc_naive(dt_str).replace(tzinfo=timezone.utc)
    return u.astimezone(a10.KST).date()


def ordered_kst_trading_days(market_bars: list[dict]) -> list[date]:
    s: set[date] = set()
    for b in market_bars:
        dt = b.get("datetime")
        if not isinstance(dt, str) or not a10.is_market_bar(dt):
            continue
        s.add(bar_kst_date(dt))
    return sorted(s)


def first_entry_after_fc(
    market_bars: list[dict], fc_u
) -> tuple[float, date] | None:
    for b in sorted(market_bars, key=lambda x: x["datetime"]):
        dt = b.get("datetime")
        if not isinstance(dt, str) or not a10.is_market_bar(dt):
            continue
        e = a10.fivem_end_utc_naive(dt)
        if e > fc_u:
            c = float(b.get("close") or b.get("open") or 0)
            if c > 0:
                return c, bar_kst_date(dt)
    return None


def last_close_on_kst_day(market_bars: list[dict], kst_d: date) -> float | None:
    best = None
    best_dt = ""
    for b in market_bars:
        dt = b.get("datetime")
        if not isinstance(dt, str) or not a10.is_market_bar(dt):
            continue
        if bar_kst_date(dt) != kst_d:
            continue
        if dt > best_dt:
            best_dt = dt
            c = float(b.get("close") or b.get("open") or 0)
            if c > 0:
                best = c
    return best


def summarize(name: str, rets: list[float]) -> dict:
    if not rets:
        return {"name": name, "n": 0}
    wins = sum(1 for r in rets if r > 0)
    return {
        "name": name,
        "n": len(rets),
        "mean_pct": round(statistics.mean(rets) * 100, 4),
        "median_pct": round(statistics.median(rets) * 100, 4),
        "win_rate": round(wins / len(rets), 4),
        "min_pct": round(min(rets) * 100, 4),
        "max_pct": round(max(rets) * 100, 4),
    }


def run() -> dict:
    rows = load_article_rows()
    mbt, pak = resolve_manifest_sources(OUT_DIR)
    if pak is None:
        raise SystemExit("per_article/manifest_per_article.json 필요")

    by_hold: dict[int, list[float]] = {n: [] for n in HOLD_GRID}
    skipped: dict[str, int] = {
        "no_free_conversion_at": 0,
        "parse_err": 0,
        "no_entry": 0,
        "no_trading_days": 0,
    }
    skip_short: dict[int, int] = {n: 0 for n in HOLD_GRID}

    for ev in iter_article_ticker_events(
        ARTICLES,
        per_article_by_key=pak,
        require_intraday=True,
        require_eod=False,
    ):
        idx = ev["article_idx"]
        row = rows[idx] if idx < len(rows) else {}
        fca = row.get("free_conversion_at")
        if not isinstance(fca, str) or not fca.strip():
            skipped["no_free_conversion_at"] += 1
            continue
        try:
            fc_u = a10.parse_publish_utc_naive(fca.strip())
        except (ValueError, TypeError):
            skipped["parse_err"] += 1
            continue

        m = ev["manifest_row"]
        rel = m.get("intraday_path")
        if not rel:
            continue
        bars_all = a10.load_intraday_bars(rel)
        market_5m = [
            b
            for b in bars_all
            if isinstance(b.get("datetime"), str) and a10.is_market_bar(b["datetime"])
        ]
        if not market_5m:
            continue

        got = first_entry_after_fc(market_5m, fc_u)
        if got is None:
            skipped["no_entry"] += 1
            continue
        entry_px, entry_kst = got

        days = ordered_kst_trading_days(market_5m)
        if not days:
            skipped["no_trading_days"] += 1
            continue
        try:
            ix = days.index(entry_kst)
        except ValueError:
            skipped["no_trading_days"] += 1
            continue

        for n in HOLD_GRID:
            j = ix + n - 1
            if j >= len(days):
                skip_short[n] += 1
                continue
            exit_px = last_close_on_kst_day(market_5m, days[j])
            if exit_px is None or entry_px <= 0:
                skip_short[n] += 1
                continue
            by_hold[n].append((exit_px - entry_px) / entry_px)

    grid = {f"hold_{n}_trading_days": summarize(f"무료 전환 후 {n}거래일(그날 장 종가)", by_hold[n]) for n in HOLD_GRID}

    return {
        "hold_definitions_trading_days": (
            "진입= 무료 전환 시각 이후 첫 장중 5분봉 종가. "
            "청산= 진입이 속한 KST 거래일을 1일째로 두고, N거래일째 날 장중 마지막 5분봉 종가."
        ),
        "grid": grid,
        "skipped": skipped,
        "skipped_insufficient_calendar_for_hold": skip_short,
    }


def main() -> None:
    out = run()
    save_p = ROOT / "data" / "analysis" / "after_free_hold_grid.json"
    save_p.parent.mkdir(parents=True, exist_ok=True)
    save_p.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"저장: {save_p}", file=sys.stderr)


if __name__ == "__main__":
    main()
