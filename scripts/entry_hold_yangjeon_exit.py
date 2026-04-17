#!/usr/bin/env python3
"""
진입 규칙은 entry_hold_analysis.py와 동일(A~F).

청산: 진입 이후 시간순 5분봉에서 **첫 양전**(해당 봉 종가 > 진입가)이면 그 종가에서 청산.
30거래일 안에 양전이 없으면, 기존과 같이 **진입 기준 +30거래일** 해당일 장종 5분봉 종가에서 청산.

출력: data/entry_hold_yangjeon_stats.json

사용:
    python3 scripts/entry_hold_yangjeon_exit.py
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
OUTPUT_PATH = BASE / "data" / "entry_hold_yangjeon_stats.json"
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
MANIFEST_PATH = EODHD_WINDOWS / "manifest.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
from entry_hold_analysis import (
    _cached_eod_bars,
    _cached_intra_bars,
    _is_market_bar,
    eod_index_for_session_ymd,
    eod_index_on_or_after,
    first_close_after_publish_bar_info,
    first_intraday_session_open,
    last_intraday_session_close,
    t1_first_close_second_open,
    valid_ticker,
)
from analyze_10m_return_path import parse_publish_utc_naive

MAX_HOLD_TRADING_DAYS = 30
ENTRY_TAGS = ("A", "B", "C", "D", "E", "F")


def _sorted_market_bars(all_intra: list) -> list:
    m = [
        b
        for b in all_intra
        if isinstance(b.get("datetime"), str) and _is_market_bar(b["datetime"])
    ]
    m.sort(key=lambda x: x["datetime"])
    return m


def _bar_index(sorted_m: list, bar: dict) -> int | None:
    dt = bar.get("datetime")
    if not isinstance(dt, str):
        return None
    for i, b in enumerate(sorted_m):
        if b.get("datetime") == dt:
            return i
    return None


def _yangjeon_or_horizon_return(
    sorted_m: list,
    start_idx: int,
    entry_px: float,
    max_session_ymd: str,
    all_intra: list,
    horizon_session_ymd: str,
) -> tuple[float, bool] | None:
    """
    Returns:
        (수익률, 양전 청산 여부). 데이터 없으면 None.
    """
    if entry_px <= 0:
        return None

    n = len(sorted_m)
    i = max(0, start_idx)
    while i < n:
        b = sorted_m[i]
        dt = b.get("datetime")
        if not isinstance(dt, str):
            i += 1
            continue
        ymd = dt[:10]
        if ymd > max_session_ymd:
            break
        cl = float(b.get("close") or b.get("open") or 0)
        if cl > entry_px:
            return (cl - entry_px) / entry_px, True
        i += 1

    sp = last_intraday_session_close(all_intra, horizon_session_ymd)
    if sp is None or sp <= 0:
        return None
    return (sp - entry_px) / entry_px, False


def run() -> None:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음:", EODHD_WINDOWS / "per_article/manifest_per_article.json", "또는", MANIFEST_PATH)
        return

    articles_path = default_articles_path(BASE)
    if not articles_path.is_file():
        print("기사 파일 없음:", articles_path)
        return

    returns_by_entry: dict[str, list[float]] = {e: [] for e in ENTRY_TAGS}
    yangjeon_hit_by_entry: dict[str, list[bool]] = {e: [] for e in ENTRY_TAGS}

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    pairs_passed_t0_t1 = 0

    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        t0_str = ev["t0"]
        rel = m.get("intraday_path")
        eod_rel = m.get("eod_path")
        if not ticker or not t0_str or not rel or not eod_rel:
            continue
        if not valid_ticker(ticker) or is_excluded(ticker):
            continue

        eod_file = EODHD_WINDOWS / eod_rel
        intra_file = EODHD_WINDOWS / rel
        if not eod_file.is_file() or not intra_file.is_file():
            continue

        bars = _cached_eod_bars(eod_rel)
        t0_d = date.fromisoformat(t0_str)
        i0 = eod_index_on_or_after(bars, t0_d)
        if i0 is None or i0 + 1 >= len(bars):
            continue
        pairs_passed_t0_t1 += 1

        all_intra = _cached_intra_bars(rel)
        sorted_m = _sorted_market_bars(all_intra)
        if not sorted_m:
            continue

        t0_date = str(bars[i0]["date"])[:10]
        t1_date = str(bars[i0 + 1]["date"])[:10]

        px_a = last_intraday_session_close(all_intra, t0_date)
        px_b = first_intraday_session_open(all_intra, t1_date)
        px_c = last_intraday_session_close(all_intra, t1_date)
        px_d, px_e = t1_first_close_second_open(all_intra, t1_date)

        day_t0 = [b for b in sorted_m if b["datetime"][:10] == t0_date]
        day_t1 = [b for b in sorted_m if b["datetime"][:10] == t1_date]

        def max_eod_A() -> tuple[int, str] | None:
            """최대 30거래일 또는 EOD 샘플 마지막 거래일 중 이른 쪽(데이터 끝 클립)."""
            if i0 >= len(bars):
                return None
            si = min(i0 + MAX_HOLD_TRADING_DAYS, len(bars) - 1)
            return si, str(bars[si]["date"])[:10]

        def max_eod_BCDE() -> tuple[int, str] | None:
            base = i0 + 1
            if base >= len(bars):
                return None
            si = min(base + MAX_HOLD_TRADING_DAYS, len(bars) - 1)
            return si, str(bars[si]["date"])[:10]

        # --- A ---
        if px_a is not None and day_t0:
            entry_bar = day_t0[-1]
            bi = _bar_index(sorted_m, entry_bar)
            if bi is not None:
                got = max_eod_A()
                if got is not None:
                    _si, horizon_ymd = got
                    max_ses = horizon_ymd
                    r = _yangjeon_or_horizon_return(
                        sorted_m, bi + 1, px_a, max_ses, all_intra, horizon_ymd
                    )
                    if r is not None:
                        ret, hit = r
                        returns_by_entry["A"].append(ret)
                        yangjeon_hit_by_entry["A"].append(hit)

        # --- B C D E ---
        m_eod = max_eod_BCDE()
        if m_eod is not None:
            _si, horizon_ymd = m_eod
            max_ses = horizon_ymd

            if px_b is not None and day_t1:
                b0 = day_t1[0]
                bi = _bar_index(sorted_m, b0)
                if bi is not None:
                    r = _yangjeon_or_horizon_return(
                        sorted_m, bi, px_b, max_ses, all_intra, horizon_ymd
                    )
                    if r is not None:
                        ret, hit = r
                        returns_by_entry["B"].append(ret)
                        yangjeon_hit_by_entry["B"].append(hit)

            if px_c is not None and day_t1:
                entry_bar = day_t1[-1]
                bi = _bar_index(sorted_m, entry_bar)
                if bi is not None:
                    r = _yangjeon_or_horizon_return(
                        sorted_m, bi + 1, px_c, max_ses, all_intra, horizon_ymd
                    )
                    if r is not None:
                        ret, hit = r
                        returns_by_entry["C"].append(ret)
                        yangjeon_hit_by_entry["C"].append(hit)

            if px_d is not None and len(day_t1) >= 1:
                b0 = day_t1[0]
                bi = _bar_index(sorted_m, b0)
                if bi is not None:
                    r = _yangjeon_or_horizon_return(
                        sorted_m, bi + 1, px_d, max_ses, all_intra, horizon_ymd
                    )
                    if r is not None:
                        ret, hit = r
                        returns_by_entry["D"].append(ret)
                        yangjeon_hit_by_entry["D"].append(hit)

            if px_e is not None and len(day_t1) >= 2:
                b1 = day_t1[1]
                bi = _bar_index(sorted_m, b1)
                if bi is not None:
                    r = _yangjeon_or_horizon_return(
                        sorted_m, bi, px_e, max_ses, all_intra, horizon_ymd
                    )
                    if r is not None:
                        ret, hit = r
                        returns_by_entry["E"].append(ret)
                        yangjeon_hit_by_entry["E"].append(hit)

        # --- F ---
        pa = ev.get("published_at")
        if isinstance(pa, str) and pa.strip():
            try:
                pu = parse_publish_utc_naive(pa.strip())
            except (ValueError, TypeError):
                pu = None
            if pu is not None:
                finfo = first_close_after_publish_bar_info(all_intra, t0_d, pu)
                if finfo is not None:
                    px_f, dk_f, entry_bar_f = finfo
                    idx_f = eod_index_for_session_ymd(bars, dk_f)
                    if idx_f is not None and px_f > 0:
                        si = min(idx_f + MAX_HOLD_TRADING_DAYS, len(bars) - 1)
                        if si >= idx_f:
                            horizon_ymd = str(bars[si]["date"])[:10]
                            bi = _bar_index(sorted_m, entry_bar_f)
                            if bi is not None:
                                r = _yangjeon_or_horizon_return(
                                    sorted_m,
                                    bi + 1,
                                    px_f,
                                    horizon_ymd,
                                    all_intra,
                                    horizon_ymd,
                                )
                                if r is not None:
                                    ret, hit = r
                                    returns_by_entry["F"].append(ret)
                                    yangjeon_hit_by_entry["F"].append(hit)

    entry_labels = {
        "A": "T=0 장종 5분봉 종가",
        "B": "T+1 첫 5분봉 시가",
        "C": "T+1 장종 5분봉 종가",
        "D": "T+1 첫 5분봉 종가",
        "E": "T+1 두 번째 5분봉 시가",
        "F": "공개 시각 직후 첫 장중 5분봉 종가",
    }

    rows: list[dict] = []
    for e in ENTRY_TAGS:
        rets = returns_by_entry[e]
        hits = yangjeon_hit_by_entry[e]
        if not rets or len(rets) != len(hits):
            continue
        wins = sum(1 for r in rets if r > 0)
        hit_y = sum(1 for h in hits if h)
        rows.append({
            "entry": e,
            "entry_label": entry_labels[e],
            "count": len(rets),
            "win_rate": wins / len(rets),
            "yangjeon_exit_rate": hit_y / len(rets),
            "avg_return": sum(rets) / len(rets),
            "avg_return_if_yangjeon": (
                sum(r for r, h in zip(rets, hits) if h) / hit_y if hit_y else 0.0
            ),
            "avg_return_if_horizon_fallback": (
                sum(r for r, h in zip(rets, hits) if not h) / (len(rets) - hit_y)
                if hit_y < len(rets)
                else 0.0
            ),
        })

    rows.sort(key=lambda x: x["entry"])

    out = {
        "generated_at": datetime.now().isoformat(),
        "methodology_note": (
            "진입은 entry_hold_analysis.py와 동일. "
            "청산: 진입 직후 다음 5분봉부터 최대 30거래일(포함)까지, "
            "종가가 진입가를 처음으로 넘는 봉(양전)에서 청산. "
            "해당 기간 양전이 없으면 호라이즌 종료일 장종 5분봉 종가로 청산. "
            "호라이즌 종료일은 EOD가 짧으면 min(진입+30거래일, 데이터 마지막 거래일)로 클립."
        ),
        "sample_summary": {
            "pairs_passed_t0_t1_calendar": pairs_passed_t0_t1,
        },
        "by_entry": rows,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Saved to {OUTPUT_PATH}")
    for r in rows:
        print(
            f"{r['entry']} {r['entry_label'][:20]}... | "
            f"n={r['count']} win_rate={r['win_rate']:.1%} "
            f"양전청산비율={r['yangjeon_exit_rate']:.1%} "
            f"avg={r['avg_return']:.2%}"
        )


if __name__ == "__main__":
    run()
