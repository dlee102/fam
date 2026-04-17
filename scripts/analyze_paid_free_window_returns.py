#!/usr/bin/env python3
"""
유료 구간(공개 시각 ~ 무료 전환 시각) vs 무료 전환 후 동일 길이 구간의 5분봉 수익률·승률.

- 진입(분모): `analyze_10m_return_path`와 동일 — published_at 이후 첫 장중 5분봉 종가(앵커).
- 유료 구간 청산: 무료 전환 시각(`free_conversion_at`) **이전까지** 끝난 마지막 5분봉 종가(앵커 이후·전환 시각 이하).
- 무료 전환 후: 전환 시각 **이후** 첫 5분봉 종가 ~ (전환 시각 + (전환−공개) 시계열 길이) 이전까지 마지막 봉 종가.

manifest: `data/eodhd_news_windows/per_article/manifest_per_article.json` 필수.

  python3 scripts/analyze_paid_free_window_returns.py

무료 전환 후 구간은 기본으로 **|수익률| > 100%** 인 극단값(단기 데이터 아티팩트 등)을 집계에서 제외합니다.
  --free-cap 1.0   기본, 소수(1.0 = 100%)
  --free-cap 0       제한 없음(전 표본)
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import date
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


def load_article_rows() -> list[dict]:
    raw = json.loads(ARTICLES.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else []


def last_close_in_range(
    market_bars: list[dict],
    t_end_max,
    t_end_min,
) -> float | None:
    """fivem_end in [t_end_min, t_end_max] — both UTC naive; 마지막 봉 종가."""
    best = None
    for b in market_bars:
        dt = b.get("datetime")
        if not isinstance(dt, str) or not a10.is_market_bar(dt):
            continue
        e = a10.fivem_end_utc_naive(dt)
        if e < t_end_min:
            continue
        if e > t_end_max:
            continue
        c = float(b.get("close") or b.get("open") or 0)
        if c > 0:
            best = c
    return best


def first_close_after(
    market_bars: list[dict],
    t_after,
) -> float | None:
    """first bar with fivem_end > t_after."""
    for b in sorted(market_bars, key=lambda x: x["datetime"]):
        dt = b.get("datetime")
        if not isinstance(dt, str) or not a10.is_market_bar(dt):
            continue
        e = a10.fivem_end_utc_naive(dt)
        if e > t_after:
            c = float(b.get("close") or b.get("open") or 0)
            return c if c > 0 else None
    return None


def last_close_after_before(
    market_bars: list[dict],
    t_after,
    t_end_max,
) -> float | None:
    """t_after < fivem_end <= t_end_max 인 마지막 봉 종가 (무료 전환 직후 구간)."""
    best = None
    for b in market_bars:
        dt = b.get("datetime")
        if not isinstance(dt, str) or not a10.is_market_bar(dt):
            continue
        e = a10.fivem_end_utc_naive(dt)
        if e <= t_after:
            continue
        if e > t_end_max:
            continue
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


def filter_free_extremes(rets: list[float], cap: float | None) -> tuple[list[float], int]:
    """|r| <= cap 인 것만 (cap None 이면 필터 없음). 제외 개수 반환."""
    if cap is None or cap <= 0:
        return list(rets), 0
    ok = [r for r in rets if -cap <= r <= cap]
    return ok, len(rets) - len(ok)


def run(*, free_cap: float | None = 1.0) -> dict:
    rows = load_article_rows()
    mbt, pak = resolve_manifest_sources(OUT_DIR)
    if pak is None:
        raise SystemExit("per_article/manifest_per_article.json 필요")

    paid_rets: list[float] = []
    free_rets: list[float] = []
    skipped: dict[str, int] = {
        "no_free_conversion_at": 0,
        "bad_time_order": 0,
        "no_anchor": 0,
        "no_paid_exit": 0,
        "no_post_entry": 0,
        "no_post_exit": 0,
    }

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
            pub_u = a10.parse_publish_utc_naive(ev["published_at"].strip())
            fc_u = a10.parse_publish_utc_naive(fca.strip())
        except (ValueError, TypeError):
            skipped["bad_time_order"] += 1
            continue
        if fc_u <= pub_u:
            skipped["bad_time_order"] += 1
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
        by_day = a10.group_by_date(market_5m)
        trading_days = sorted(by_day.keys())
        t0 = date.fromisoformat(ev["t0"])
        event_idx = None
        for i, dk in enumerate(trading_days):
            sk = a10.first_session_kst_date(dk, by_day)
            if sk is not None and sk >= t0:
                event_idx = i
                break
        if event_idx is None:
            skipped["no_anchor"] += 1
            continue

        anchor, anchor_end = a10.anchor_close_first_on_or_after_publish(
            by_day, trading_days, event_idx, pub_u
        )
        if anchor is None or anchor_end is None or anchor <= 0:
            skipped["no_anchor"] += 1
            continue

        paid_exit = last_close_in_range(market_5m, fc_u, anchor_end)
        if paid_exit is None:
            skipped["no_paid_exit"] += 1
            continue
        paid_r = (paid_exit - anchor) / anchor
        paid_rets.append(paid_r)

        duration = fc_u - pub_u
        post_end = fc_u + duration

        post_entry = first_close_after(market_5m, fc_u)
        if post_entry is None:
            skipped["no_post_entry"] += 1
            continue

        post_exit = last_close_after_before(market_5m, fc_u, post_end)
        if post_exit is None:
            skipped["no_post_exit"] += 1
            continue
        free_r = (post_exit - post_entry) / post_entry
        free_rets.append(free_r)

    free_raw_n = len(free_rets)
    free_filtered, n_free_excluded = filter_free_extremes(free_rets, free_cap)

    methodology = (
        "앵커= published_at 이후 첫 장중 5분봉 종가. "
        "유료 청산= 전환 시각 이전까지 끝난 마지막 봉 종가(앵커 이후). "
        "무료 후 진입= 전환 시각 이후 첫 봉 종가, 청산= 전환+Δt 이전 마지막 봉 종가(Δt=무료전환−공개 시계열). "
        "intraday_ok 기사만."
    )
    if free_cap is not None and free_cap > 0:
        methodology += (
            f" 무료 후 집계는 |수익률|≤{free_cap:.0%}(소수 {free_cap}) 밖 극단값 제외."
        )

    out: dict = {
        "paid_window": summarize("유료 구간 (공개→무료 전환 시각까지)", paid_rets),
        "after_free_window": summarize(
            "무료 전환 후 동일 길이 구간 (전환 직후→전환+Δt)",
            free_filtered,
        ),
        "after_free_window_unfiltered_n": free_raw_n,
        "after_free_extreme_excluded": n_free_excluded,
        "after_free_cap_abs": free_cap,
        "skipped": skipped,
        "methodology": methodology,
    }
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--free-cap",
        type=float,
        default=1.0,
        metavar="소수",
        help="|무료 후 수익률| 상한(소수). 1.0=±100%% 밖 제외. 0이면 필터 없음.",
    )
    args = parser.parse_args()
    cap: float | None = None if args.free_cap == 0 else args.free_cap
    out = run(free_cap=cap)
    save_p = ROOT / "data" / "analysis" / "paid_free_window_returns.json"
    save_p.parent.mkdir(parents=True, exist_ok=True)
    save_p.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"저장: {save_p}", file=sys.stderr)


if __name__ == "__main__":
    main()
