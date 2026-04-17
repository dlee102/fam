#!/usr/bin/env python3
"""
입장 시점 & 보유 기간별 승률/수익률 분석 (전부 5분봉)

data/eodhd_news_windows manifest 행(티커, t0)마다 intraday 5m + EOD 일봉 날짜(거래일 순서)만 사용.
일봉 OHLC 가격은 쓰지 않음 — 진입·청산 가격은 모두 5분봉에서 취한다.

Entry:
- A: t0 거래일 장중 마지막 5분봉 종가
- B: T+1 거래일 첫 5분봉 시가
- C: T+1 거래일 장중 마지막 5분봉 종가
- D: T+1 첫 5분봉 종가
- E: T+1 두 번째 5분봉 시가
- F: API published_at 이후(5분봉 종료 시각 기준) 첫 장중 5분봉 종가 (analyze_10m_return_path 앵커와 동일)

Hold: 1..30 거래일 — 청산은 해당 거래일 장중 마지막 5분봉 종가
(A·F는 진입이 잡힌 거래일 기준 +h, B~E는 T+1 진입일 기준 +h)
"""

from __future__ import annotations

import json
import sys
from functools import lru_cache
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
OUTPUT_PATH = BASE / "data" / "entry_hold_stats.json"
PUBLISH_HORIZON_PATH = BASE / "data" / "publish_horizon_curve.json"
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
MANIFEST_PATH = EODHD_WINDOWS / "manifest.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from excluded_tickers import is_excluded
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
from analyze_10m_return_path import (
    first_session_kst_date,
    fivem_end_utc_naive,
    group_by_date,
    is_market_bar,
    parse_publish_utc_naive,
)

HOLD_DAYS = list(range(1, 31))
ATTR_HOLD_DAYS: set[int] = {1, 5, 10, 18, 22}  # 티커별 귀속 분석 기준 거래일 (18: 그리드 상위 조합용)


@lru_cache(maxsize=1024)
def _cached_eod_bars(rel: str) -> list:
    p = EODHD_WINDOWS / rel
    raw = json.loads(p.read_text(encoding="utf-8"))
    return raw.get("bars") or []


@lru_cache(maxsize=1024)
def _cached_intra_bars(rel: str) -> list:
    p = EODHD_WINDOWS / rel
    raw = json.loads(p.read_text(encoding="utf-8"))
    return raw.get("bars") or []


def _is_market_bar(dt_str: str) -> bool:
    """EODHD 한국장 5분봉: UTC 00:00~06:25 (KST 09:00~15:25)."""
    hm = dt_str[11:16]
    return "00:00" <= hm <= "06:25"


def eod_index_on_or_after(bars: list, t0: date) -> int | None:
    """첫 거래일 인덱스: 일봉 date >= t0(기사 달력일). 주말·휴장일 기사도 다음 거래일로 맞춤."""
    for k, b in enumerate(bars):
        try:
            d = date.fromisoformat(str(b.get("date", ""))[:10])
        except ValueError:
            continue
        if d >= t0:
            return k
    return None


def _day_session_bars(all_bars: list, ymd: str) -> list:
    return [
        b
        for b in all_bars
        if isinstance(b.get("datetime"), str)
        and b["datetime"][:10] == ymd
        and _is_market_bar(b["datetime"])
    ]


def last_intraday_session_close(all_bars: list, ymd: str) -> float | None:
    day = _day_session_bars(all_bars, ymd)
    if not day:
        return None
    day.sort(key=lambda x: x["datetime"])
    last = day[-1]
    v = float(last.get("close") or last.get("open") or 0)
    return v if v > 0 else None


def first_intraday_session_open(all_bars: list, ymd: str) -> float | None:
    day = _day_session_bars(all_bars, ymd)
    if not day:
        return None
    day.sort(key=lambda x: x["datetime"])
    first = day[0]
    v = float(first.get("open") or first.get("close") or 0)
    return v if v > 0 else None


def t1_first_close_second_open(all_bars: list, t1_date: str) -> tuple[float | None, float | None]:
    """T+1: (첫 봉 종가 D, 둘째 봉 시가 E)."""
    day_bars = _day_session_bars(all_bars, t1_date)
    day_bars.sort(key=lambda x: x["datetime"])
    if not day_bars:
        return None, None
    b0 = day_bars[0]
    d_raw = float(b0.get("close") or b0.get("open") or 0)
    d_px: float | None = d_raw if d_raw > 0 else None
    e_px = None
    if len(day_bars) > 1:
        b1 = day_bars[1]
        v = float(b1.get("open") or b1.get("close") or 0)
        if v > 0:
            e_px = v
    return d_px, e_px


def eod_index_for_session_ymd(eod_bars: list, ymd: str) -> int | None:
    """EOD `bars[k]['date']`가 세션일 ymd(YYYY-MM-DD)와 일치하는 첫 인덱스."""
    for k, b in enumerate(eod_bars):
        if str(b.get("date", ""))[:10] == ymd:
            return k
    return None


def first_close_after_publish_bar_info(
    all_intra: list,
    t0_d: date,
    publish_utc_naive: datetime,
) -> tuple[float, str, dict] | None:
    """
    `published_at` 이후 종료되는 첫 장중 5분봉 — (종가, 세션일 키, 해당 봉 dict).
    `first_close_after_publish_on_calendar`와 동일한 봉을 가리킨다.
    """
    market_5m = [
        b
        for b in all_intra
        if isinstance(b.get("datetime"), str) and is_market_bar(b["datetime"])
    ]
    if not market_5m:
        return None
    by_day = group_by_date(market_5m)
    trading_days = sorted(by_day.keys())
    event_idx = None
    for i, dk in enumerate(trading_days):
        sk = first_session_kst_date(dk, by_day)
        if sk is not None and sk >= t0_d:
            event_idx = i
            break
    if event_idx is None:
        return None
    for dk in trading_days[event_idx:]:
        day_bars = sorted(by_day.get(dk, []), key=lambda x: x["datetime"])
        for b in day_bars:
            dt = b.get("datetime")
            if not isinstance(dt, str) or not is_market_bar(dt):
                continue
            end = fivem_end_utc_naive(dt)
            if end >= publish_utc_naive:
                v = float(b.get("close") or b.get("open") or 0)
                if v > 0:
                    return v, dk, b
    return None


def first_close_after_publish_on_calendar(
    all_intra: list,
    t0_d: date,
    publish_utc_naive: datetime,
) -> tuple[float, str] | None:
    """
    `published_at`(UTC naive) 이후에 **종료**되는 장중 5분봉 중 시간상 가장 이른 봉의 종가.
    장 마감 뒤 공개면 다음 거래일 첫 유효 봉까지 진행 (analyze_10m_return_path 앵커와 동일).

    Returns:
        (종가, 세션일 키) — 세션일은 5분봉 `datetime[:10]` (한국장 EODHD 버킷에서 UTC일=세션일).
    """
    got = first_close_after_publish_bar_info(all_intra, t0_d, publish_utc_naive)
    if got is None:
        return None
    v, dk, _ = got
    return v, dk


def valid_ticker(t: str) -> bool:
    return bool(t and len(t) == 6 and t.isdigit())


def run() -> None:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음:", EODHD_WINDOWS / "per_article/manifest_per_article.json", "또는", MANIFEST_PATH)
        return

    articles_path = default_articles_path(BASE)
    if not articles_path.is_file():
        print("기사 파일 없음:", articles_path)
        return

    returns_by_combo: dict[tuple[str, int], list[float]] = {}
    returns_by_ticker: dict[tuple[str, int], dict[str, list[float]]] = {}
    for e in ["A", "B", "C", "D", "E", "F"]:
        for h in HOLD_DAYS:
            returns_by_combo[(e, h)] = []
            if h in ATTR_HOLD_DAYS:
                returns_by_ticker[(e, h)] = {}

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    pairs_passed_t0_t1_calendar = 0
    pairs_with_at_least_one_observation = 0

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
        pairs_passed_t0_t1_calendar += 1
        contributed = False
        # 보유 일수별로 청산일이 데이터 범위 안일 때만 표본에 넣음 (최대 N일이 짧은 종목도 소호라이즌은 집계)

        all_intra = _cached_intra_bars(rel)

        t0_date = bars[i0]["date"]
        t1_date = bars[i0 + 1]["date"]

        px_a = last_intraday_session_close(all_intra, t0_date)
        px_b = first_intraday_session_open(all_intra, t1_date)
        px_c = last_intraday_session_close(all_intra, t1_date)
        px_d, px_e = t1_first_close_second_open(all_intra, t1_date)

        px_f: float | None = None
        i_entry_f: int | None = None
        pa = ev.get("published_at")
        if isinstance(pa, str) and pa.strip():
            try:
                pu = parse_publish_utc_naive(pa.strip())
            except (ValueError, TypeError):
                pu = None
            if pu is not None:
                got = first_close_after_publish_on_calendar(all_intra, t0_d, pu)
                if got:
                    c_f, dk_f = got
                    idx_f = eod_index_for_session_ymd(bars, dk_f)
                    if idx_f is not None:
                        px_f = c_f
                        i_entry_f = idx_f

        def sell_px(sell_i: int) -> float | None:
            if sell_i >= len(bars):
                return None
            sd = bars[sell_i]["date"]
            return last_intraday_session_close(all_intra, sd)

        for h in HOLD_DAYS:
            if px_a is not None:
                si = i0 + h
                sp = sell_px(si)
                if sp is not None:
                    r_a = (sp - px_a) / px_a
                    returns_by_combo[("A", h)].append(r_a)
                    if h in ATTR_HOLD_DAYS:
                        returns_by_ticker[("A", h)].setdefault(ticker, []).append(r_a)
                    contributed = True

            for tag, px in [("B", px_b), ("C", px_c), ("D", px_d), ("E", px_e)]:
                if px is None or px <= 0:
                    continue
                si = i0 + 1 + h
                sp = sell_px(si)
                if sp is not None:
                    r_t = (sp - px) / px
                    returns_by_combo[(tag, h)].append(r_t)
                    if h in ATTR_HOLD_DAYS:
                        returns_by_ticker[(tag, h)].setdefault(ticker, []).append(r_t)
                    contributed = True

            if px_f is not None and i_entry_f is not None:
                si = i_entry_f + h
                sp = sell_px(si)
                if sp is not None:
                    r_f = (sp - px_f) / px_f
                    returns_by_combo[("F", h)].append(r_f)
                    if h in ATTR_HOLD_DAYS:
                        returns_by_ticker[("F", h)].setdefault(ticker, []).append(r_f)
                    contributed = True

        if contributed:
            pairs_with_at_least_one_observation += 1

    entry_labels = {
        "A": "T=0 장종 5분봉 종가",
        "B": "T+1 첫 5분봉 시가",
        "C": "T+1 장종 5분봉 종가",
        "D": "T+1 첫 5분봉 종가",
        "E": "T+1 두 번째 5분봉 시가",
        "F": "공개 시각 직후 첫 장중 5분봉 종가",
    }

    rows: list[dict] = []
    for (entry, hold), rets in returns_by_combo.items():
        if not rets:
            continue
        arr = [r for r in rets if r is not None]
        if not arr:
            continue
        wins = sum(1 for r in arr if r > 0)
        pos_arr = [r for r in arr if r > 0]
        neg_arr = [r for r in arr if r < 0]
        rows.append({
            "entry": entry,
            "entry_label": entry_labels[entry],
            "hold_days": hold,
            "count": len(arr),
            "win_rate": wins / len(arr),
            "avg_return": sum(arr) / len(arr),
            "n_pos": len(pos_arr),
            "avg_pos_return": sum(pos_arr) / len(pos_arr) if pos_arr else 0.0,
            "n_neg": len(neg_arr),
            "avg_neg_return": sum(neg_arr) / len(neg_arr) if neg_arr else 0.0,
        })

    rows.sort(key=lambda x: (x["entry"], x["hold_days"]))

    if not rows:
        print("집계 결과 없음")
        return

    best_wr = max(rows, key=lambda x: x["win_rate"])
    best_ret = max(rows, key=lambda x: x["avg_return"])

    def _sum_slice(row: dict) -> dict:
        return {
            "entry": row["entry"],
            "entry_label": row["entry_label"],
            "hold_days": row["hold_days"],
            "win_rate": row["win_rate"],
            "avg_return": row["avg_return"],
            "count": row["count"],
        }

    out = {
        "generated_at": datetime.now().isoformat(),
        "methodology_note": (
            "전 구간 EODHD 5분봉만으로 진입·청산 가격을 잡았습니다. "
            "거래일 순서는 동일 윈도우의 EOD 일봉 `bars`의 `date` 열로만 사용했으며, "
            "일봉 시가/종가 숫자는 사용하지 않습니다. "
            "대상은 `somedaynews_article_tickers.json`에서 **유료 기사**에 붙은 종목을 한 건씩(중복 기사 레코드는 각각 유지; 빌드 기본), "
            "해당 종목 manifest에 intraday_ok·eod_ok인 경우입니다. 이벤트일은 기사 date이며 "
            "주말·휴장이면 그 이후 첫 거래일로 맞춥니다."
        ),
        "summary": {
            "best_win_rate": _sum_slice(best_wr),
            "best_avg_return": _sum_slice(best_ret),
        },
        "detail": rows,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # 발행일(T0) 이후 거래일 기준 — 진입별 수익률 곡선 (UI용)
    series: dict[str, list[dict]] = {e: [] for e in entry_labels}
    for r in rows:
        if 1 <= r["hold_days"] <= 30:
            series[r["entry"]].append({
                "trading_day": r["hold_days"],
                "avg_return_pct": round(r["avg_return"] * 100, 4),
                "win_rate": round(r["win_rate"], 6),
                "count": r["count"],
                "n_pos": r["n_pos"],
                "avg_pos_return_pct": round(r["avg_pos_return"] * 100, 4),
                "n_neg": r["n_neg"],
                "avg_neg_return_pct": round(r["avg_neg_return"] * 100, 4),
            })
    for e in series:
        series[e].sort(key=lambda x: x["trading_day"])

    def _entry_horizon_stats(e: str) -> dict:
        pts = [r for r in rows if r["entry"] == e and 1 <= r["hold_days"] <= 30]
        if not pts:
            return {}
        p1 = next((r for r in pts if r["hold_days"] == 1), None)
        max_h = max(r["hold_days"] for r in pts)
        p_last = next((r for r in pts if r["hold_days"] == max_h), None)
        min_n = min(r["count"] for r in pts)
        return {
            "label": entry_labels[e],
            "n_at_1_trading_day": p1["count"] if p1 else 0,
            "min_n_any_horizon": min_n,
            "longest_horizon_trading_days": max_h,
            "n_at_longest_horizon": p_last["count"] if p_last else 0,
        }

    def _build_ticker_attr(e: str, h: int) -> list[dict]:
        tret = returns_by_ticker.get((e, h), {})
        result = []
        for t, rets in tret.items():
            if not rets:
                continue
            avg = sum(rets) / len(rets)
            wins = sum(1 for r in rets if r > 0)
            pos_arr = [r for r in rets if r > 0]
            neg_arr = [r for r in rets if r < 0]
            result.append({
                "ticker": t,
                "count": len(rets),
                "avg_return_pct": round(avg * 100, 4),
                "win_rate": round(wins / len(rets), 4),
                "avg_pos_return_pct": round(sum(pos_arr) / len(pos_arr) * 100, 4) if pos_arr else 0.0,
                "avg_neg_return_pct": round(sum(neg_arr) / len(neg_arr) * 100, 4) if neg_arr else 0.0,
                "n_pos": len(pos_arr),
                "n_neg": len(neg_arr),
            })
        result.sort(key=lambda x: x["avg_return_pct"])
        return result

    ticker_attribution = {
        e: {
            str(h): _build_ticker_attr(e, h)
            for h in sorted(ATTR_HOLD_DAYS)
            if (e, h) in returns_by_ticker
        }
        for e in entry_labels
    }

    horizon_out = {
        "generated_at": out["generated_at"],
        "definition": (
            "기사 발행일(T0) 이후 최초 거래일 기준. "
            "A: T0 장종 5분봉 종가 진입. "
            "B: T+1 첫 5분봉 시가. C: T+1 장종 5분봉 종가. "
            "D: T+1 첫 5분봉 종가. E: T+1 두 번째 5분봉 시가. "
            "F: API published_at 이후 종료되는 첫 장중 5분봉 종가(매매 가능 시점에 가장 가까운 봉 종가). "
            "청산은 진입 거래일(A·F) 또는 T+1(B~E) 기준 N거래일 뒤 장종 5분봉 종가."
        ),
        "sample_summary": {
            "unit_note": "집계 단위: 기사 1건 × 종목 1코드 = 표본 1개.",
            "pairs_passed_t0_t1_calendar": pairs_passed_t0_t1_calendar,
            "pairs_with_at_least_one_observation": pairs_with_at_least_one_observation,
            "by_entry": {e: _entry_horizon_stats(e) for e in entry_labels if series[e]},
        },
        "entries": {
            e: {"label": entry_labels[e], "points": series[e]}
            for e in entry_labels if series[e]
        },
        "ticker_attribution": ticker_attribution,
    }
    with open(PUBLISH_HORIZON_PATH, "w", encoding="utf-8") as f:
        json.dump(horizon_out, f, ensure_ascii=False, indent=2)

    print(f"Saved to {OUTPUT_PATH}")
    print(f"Horizon curve (entry C): {PUBLISH_HORIZON_PATH}")
    print(f"Best Win Rate: {best_wr['entry_label']}, {best_wr['hold_days']}일 -> {best_wr['win_rate']:.1%}, n={best_wr['count']}")
    print(f"Best Avg Return: {best_ret['entry_label']}, {best_ret['hold_days']}일 -> {best_ret['avg_return']:.2%}, n={best_ret['count']}")


if __name__ == "__main__":
    run()
