#!/usr/bin/env python3
"""
뉴스 기사 공개 이후 10분봉 누적 수익률 (10거래일)

- 기준가(분모): 기사 공개 시각 **이후**(또는 동시에 끝난 5분봉) 시계열에서 **가장 이른** 장중 5분봉 **종가**
  (미래 방향으로 가장 가까운 관측치). EODHD 봉 시각은 UTC naive로 맞춤.
- 공개 시각은 API **`published_at`만** 사용(비어 있으면 빌드·이벤트 스트림에서 제외; 가짜 시각 보강 없음).
- 공개 이후 봉이 데이터에 없으면 직전 거래일 장중 마지막 5분봉 종가, 그다음 이벤트일 첫 봉 시가(폴백).
- 이후 각 10분봉 종가는 위 기준가 대비 누적 수익률.

출력: data/analysis/return_path_10m.json

집계: **`somedaynews_article_tickers.json`에 있는 유료 기사**에 붙은 종목을 한 건씩 센다(같은 기사가 여러 레코드면 각각 유지). 빌드 기본은 유료만.

사용:
    python3 scripts/analyze_10m_return_path.py
"""
from __future__ import annotations

import json
import statistics
import sys
from functools import lru_cache
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
OUT_DIR = ROOT / "data" / "eodhd_news_windows"
SAVE_DIR = ROOT / "data" / "analysis"
SAVE_DIR.mkdir(parents=True, exist_ok=True)

KST = ZoneInfo("Asia/Seoul")

MAX_TRADING_DAYS = 10
BARS_PER_DAY_10M = 39
TOTAL_BARS = MAX_TRADING_DAYS * BARS_PER_DAY_10M


@lru_cache(maxsize=1024)
def load_intraday_bars(rel_path: str) -> list:
    """티커별 5분봉 JSON을 한 번만 파싱(기사별 종목 표본 반복 시 I/O 절감)."""
    raw = json.loads((OUT_DIR / rel_path).read_text(encoding="utf-8"))
    return raw.get("bars") or []


@lru_cache(maxsize=1024)
def load_eod_bars(rel_path: str) -> list:
    raw = json.loads((OUT_DIR / rel_path).read_text(encoding="utf-8"))
    return raw.get("bars") or []


def dt_key(dt_str: str) -> str:
    return dt_str[11:16]


def is_market_bar(dt_str: str) -> bool:
    hm = dt_key(dt_str)
    return "00:00" <= hm <= "06:25"


def bar_start_utc_naive(dt_str: str) -> datetime:
    return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")


def fivem_end_utc_naive(dt_str: str) -> datetime:
    return bar_start_utc_naive(dt_str) + timedelta(minutes=5)


def parse_publish_utc_naive(published_at: str) -> datetime:
    """
    EODHD 5분봉 시각(UTC naive)과 비교할 기사 공개 시각을 UTC naive로 반환.

    - `published_at`에 오프셋이 있으면 UTC로 환산.
    - **타임존이 없는 값은 KST(Asia/Seoul) 달력 시각**으로 해석.
    """
    s = published_at.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    aware = dt.replace(tzinfo=KST)
    return aware.astimezone(timezone.utc).replace(tzinfo=None)


def to_10m_bars(bars_5m: list[dict]) -> list[dict]:
    result = []
    i = 0
    while i < len(bars_5m):
        a = bars_5m[i]
        if i + 1 < len(bars_5m):
            b = bars_5m[i + 1]
            h_a = a.get("high") or a.get("close") or 0
            h_b = b.get("high") or b.get("close") or 0
            l_a = a.get("low") or a.get("close") or float("inf")
            l_b = b.get("low") or b.get("close") or float("inf")
            bar = {
                "datetime": a["datetime"],
                "open": a.get("open") or a.get("close"),
                "high": max(h_a, h_b),
                "low": min(l_a, l_b),
                "close": b.get("close") or b.get("open"),
                "volume": (a.get("volume") or 0) + (b.get("volume") or 0),
            }
        else:
            bar = {**a}
        result.append(bar)
        i += 2
    return result


def group_by_date(bars: list[dict]) -> dict[str, list[dict]]:
    d: dict[str, list[dict]] = {}
    for b in bars:
        day = b["datetime"][:10]
        d.setdefault(day, []).append(b)
    return d


def first_session_kst_date(day_key: str, by_day: dict[str, list[dict]]) -> date | None:
    """UTC 버킷 `day_key` 안 장중 첫 5분봉의 **KST 달력일**(한국장 세션 기준)."""
    bars = [
        b
        for b in by_day.get(day_key, [])
        if isinstance(b.get("datetime"), str) and is_market_bar(b["datetime"])
    ]
    if not bars:
        return None
    bars.sort(key=lambda x: x["datetime"])
    u = bar_start_utc_naive(bars[0]["datetime"]).replace(tzinfo=timezone.utc)
    return u.astimezone(KST).date()


def anchor_close_first_on_or_after_publish(
    by_day: dict[str, list[dict]],
    trading_days: list[str],
    event_idx: int,
    publish_utc_naive: datetime,
) -> tuple[float | None, datetime | None]:
    """
    기사 공개 시각 이후(5분봉 **종료** 시각이 공개 시각 이상)로 잡힌 장중 봉 중, 시간순으로 **가장 이른** 봉의 종가.
    당일 장 마감 뒤에 기사가 나온 경우에는 이후 거래일 첫 유효 봉까지 진행.

    Returns:
        (anchor_price, anchor_bar_end_utc) — anchor_bar_end_utc 는 해당 5분봉 종료 시각(UTC naive).
        D0 경로를 이 시각 이후 봉부터만 쌓아 공개 이전 가격 혼입을 막는 데 씁니다.
    """
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
                    return v, end
    return None, None


def prev_trading_day_last_close(by_day: dict, trading_days: list[str], event_idx: int) -> float | None:
    if event_idx <= 0:
        return None
    pd = trading_days[event_idx - 1]
    day = sorted(by_day[pd], key=lambda x: x["datetime"])
    if not day:
        return None
    last = day[-1]
    v = float(last.get("close") or last.get("open") or 0)
    return v if v > 0 else None


def extract_series_with_intraday(
    ticker_path: str,
    t0_str: str,
    published_at: str | None = None,
) -> tuple[list[float], dict[str, float | None]] | None:
    """
    `extract_series`와 동일 경로 + 당일 시가·갭·공개 전 변동·시가→공개 직후 기준가(%) 진단(5분봉 1패스).
    """
    if not published_at or not str(published_at).strip():
        return None
    bars_5m_all = load_intraday_bars(ticker_path)
    t0 = date.fromisoformat(t0_str)
    try:
        publish_utc = parse_publish_utc_naive(published_at.strip())
    except (ValueError, TypeError):
        return None

    market_5m = [
        b for b in bars_5m_all if isinstance(b.get("datetime"), str) and is_market_bar(b["datetime"])
    ]
    by_day = group_by_date(market_5m)
    trading_days = sorted(by_day.keys())

    event_idx = None
    for i, dk in enumerate(trading_days):
        sk = first_session_kst_date(dk, by_day)
        if sk is not None and sk >= t0:
            event_idx = i
            break
    if event_idx is None:
        return None

    window_days = trading_days[event_idx : event_idx + MAX_TRADING_DAYS]
    if not window_days:
        return None

    anchor, anchor_bar_end = anchor_close_first_on_or_after_publish(by_day, trading_days, event_idx, publish_utc)
    if anchor is None:
        # 폴백: 전일 마지막 봉 종가. anchor_bar_end=None → D0 전체 봉 포함(공개 이전 혼입 주의).
        anchor = prev_trading_day_last_close(by_day, trading_days, event_idx)
        anchor_bar_end = None
    first_day_bars = sorted(by_day[window_days[0]], key=lambda x: x["datetime"])
    try:
        anchor_num = float(anchor) if anchor is not None else 0.0
    except (TypeError, ValueError):
        anchor_num = 0.0
    if anchor_num <= 0:
        if not first_day_bars:
            return None
        anchor = float(first_day_bars[0].get("open") or first_day_bars[0].get("close") or 0)
        if anchor <= 0:
            return None
        anchor_num = anchor
    anchor_f = float(anchor_num)

    diag: dict[str, float | None] = {
        "overnight_gap": None,
        "open_to_anchor_pct": None,
        "pre_publish_range_pct": None,
        "anchor_price": anchor_f,
    }
    if first_day_bars:
        session_open = float(first_day_bars[0].get("open") or first_day_bars[0].get("close") or 0)
        prev_c = prev_trading_day_last_close(by_day, trading_days, event_idx)
        if session_open > 0:
            if prev_c and float(prev_c) > 0:
                diag["overnight_gap"] = session_open / float(prev_c) - 1.0
            diag["open_to_anchor_pct"] = (anchor_f / session_open - 1.0) * 100.0
            hi, lo = session_open, session_open
            for b in first_day_bars:
                end = fivem_end_utc_naive(b["datetime"])
                if end > publish_utc:
                    break
                h = float(b.get("high") or b.get("close") or 0)
                l = float(b.get("low") or b.get("close") or 0)
                if h > 0:
                    hi = max(hi, h)
                if l > 0:
                    lo = min(lo, l) if lo > 0 else l
            diag["pre_publish_range_pct"] = (hi - lo) / session_open * 100.0

    path: list[float] = []
    for day_idx, day in enumerate(window_days):
        bars_5m_day = sorted(by_day[day], key=lambda x: x["datetime"])
        # D0: anchor 봉 이후 5분봉만 포함해 공개 이전 가격이 경로에 섞이는 것을 방지.
        # anchor_bar_end 가 None 이면 폴백 케이스이므로 전체 봉 포함.
        if day_idx == 0 and anchor_bar_end is not None:
            bars_5m_day = [
                b for b in bars_5m_day
                if fivem_end_utc_naive(b["datetime"]) > anchor_bar_end
            ]
        bars_10m = to_10m_bars(bars_5m_day)
        for b in bars_10m:
            close_val = b.get("close") or b.get("open")
            if close_val is None:
                path.append(path[-1] if path else 0.0)
            else:
                path.append(float(close_val) / anchor_f - 1.0)

    if not path:
        return None

    last = path[-1]
    while len(path) < TOTAL_BARS:
        path.append(last)
    return path[:TOTAL_BARS], diag


def extract_series(
    ticker_path: str,
    t0_str: str,
    published_at: str | None = None,
) -> list[float] | None:
    """
    기사 공개 이후 가장 이른 5분봉 종가를 분모로 한 10분봉 누적 수익률 시퀀스.
    """
    out = extract_series_with_intraday(ticker_path, t0_str, published_at)
    return out[0] if out else None


def main() -> None:
    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        raise SystemExit(f"기사 파일 없음: {articles_path}")

    mbt, pak = resolve_manifest_sources(OUT_DIR)
    if mbt is None and pak is None:
        raise SystemExit(
            f"manifest 없음: {OUT_DIR / 'per_article/manifest_per_article.json'} 또는 {OUT_DIR / 'manifest.json'}"
        )
    iter_kw = (
        {"per_article_by_key": pak}
        if pak is not None
        else {"manifest_by_ticker": mbt}
    )

    all_series: list[list[float]] = []
    meta: list[dict] = []
    n_candidates = 0
    n_skipped_no_series = 0

    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        n_candidates += 1
        m = ev["manifest_row"]
        series = extract_series(
            m["intraday_path"],
            ev["t0"],
            ev["published_at"],
        )
        if series is None:
            n_skipped_no_series += 1
            continue
        all_series.append(series)
        eod_bars = load_eod_bars(m["eod_path"]) if m.get("eod_ok") else []
        eod_dates = [b["date"] for b in eod_bars]
        t0 = date.fromisoformat(ev["t0"])
        event_day_idx = next((i for i, d in enumerate(eod_dates) if date.fromisoformat(d) >= t0), None)
        eod_idx = event_day_idx
        prev_close = eod_bars[eod_idx - 1]["close"] if eod_idx and eod_idx > 0 else None
        event_close = eod_bars[eod_idx]["close"] if eod_idx is not None and eod_idx < len(eod_bars) else None
        ev_vol = eod_bars[eod_idx].get("volume", 0) or 0 if eod_idx is not None and eod_idx < len(eod_bars) else 0
        pre_vols = [b.get("volume", 0) or 0 for b in eod_bars[max(0, (eod_idx or 0) - 20) : eod_idx or 0]]
        avg_vol = sum(pre_vols) / len(pre_vols) if pre_vols else 0
        vol_ratio = ev_vol / avg_vol if avg_vol > 0 else None
        event_day_ret = (event_close / prev_close - 1) if prev_close and event_close else None
        meta.append({
            "article_idx": ev["article_idx"],
            "ticker": ev["ticker"],
            "t0": ev["t0"],
            "event_day_ret": event_day_ret,
            "vol_ratio": vol_ratio,
        })

    n_total = len(all_series)
    n_distinct = len({x["ticker"] for x in meta})
    print(
        f"후보(기사에 붙은 종목): {n_candidates} | "
        f"5분봉 경로 성공: {n_total} (서로 다른 종목 {n_distinct}개) | "
        f"경로 스킵: {n_skipped_no_series}",
    )

    def path_stats(series_list: list[list[float]]) -> dict:
        if not series_list:
            return {}
        mean_p, median_p, win_p, n_p = [], [], [], []
        for b_idx in range(TOTAL_BARS):
            v = [s[b_idx] for s in series_list if b_idx < len(s)]
            mean_p.append(sum(v) / len(v) if v else 0.0)
            median_p.append(statistics.median(v) if v else 0.0)
            win_p.append(sum(1 for x in v if x > 0) / len(v) if v else 0.0)
            n_p.append(len(v))
        return {"mean": mean_p, "median": median_p, "win_rate": win_p, "n": n_p}

    # 패딩된 경로 비율 추적: 실제 봉 수가 TOTAL_BARS 미만인 시리즈 개수
    n_padded = sum(1 for s in all_series if len(set(s[-5:])) == 1)  # 끝 5개가 같으면 패딩 의심

    labels = [f"D{d}B{b}" for d in range(MAX_TRADING_DAYS) for b in range(BARS_PER_DAY_10M)]

    def sub_series(pred):
        return [s for s, mx in zip(all_series, meta) if pred(mx)]

    subgroups = {
        "all": all_series,
        "vol_ge_2x": sub_series(lambda m: m.get("vol_ratio") is not None and m["vol_ratio"] >= 2),
        "vol_lt_2x": sub_series(lambda m: m.get("vol_ratio") is not None and 0 < m["vol_ratio"] < 2),
        "vol_ge_5x": sub_series(lambda m: m.get("vol_ratio") is not None and m["vol_ratio"] >= 5),
        "event_pos": sub_series(lambda m: m.get("event_day_ret") is not None and 0 < m["event_day_ret"] <= 1),
        "event_nonpos": sub_series(
            lambda m: m.get("event_day_ret") is not None and m["event_day_ret"] <= 0 and abs(m["event_day_ret"]) <= 1
        ),
    }

    result = {
        "bar_labels": labels,
        "bars_per_day": BARS_PER_DAY_10M,
        "total_bars": TOTAL_BARS,
        "n_events": n_total,
        "n_distinct_tickers": n_distinct,
        "n_tickers": n_total,
        "n_article_ticker_candidates": n_candidates,
        "n_skipped_no_price_path": n_skipped_no_series,
        "n_padded_series": n_padded,
        "anchor_methodology": (
            "집계: 유료 기사에 붙은 종목을 한 건씩(같은 기사 중복 레코드는 각각 유지; 빌드 기본). 기사 date는 KST 달력일; "
            "이벤트 첫 거래일은 장중 세션의 KST 날짜가 그 날짜 이상인 첫 날. "
            "분모 = API published_at만(오프셋 없는 시각은 KST로 해석) **이후** 끝난 "
            "장중 5분봉 중 시간상 가장 이른 봉의 종가(미래 방향 최근접); 폴백은 직전 거래일 장중 마지막 봉 등. "
            "D0 경로는 anchor 봉 이후 5분봉부터만 포함(공개 이전 가격 혼입 방지). "
            "이후 10분봉은 그 분모 대비 누적 수익률."
        ),
        "subgroups": {name: path_stats(sg) for name, sg in subgroups.items()},
    }

    out_path = SAVE_DIR / "return_path_10m.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {out_path}")

    for name, sg in subgroups.items():
        stats = result["subgroups"][name]
        if not stats:
            continue
        mean_end = stats["mean"][-1]
        median_end = stats["median"][-1]
        win_end = stats["win_rate"][-1]
        n_end = stats["n"][-1] if stats["n"] else 0
        print(f"[{name:20s}] n={n_end:4d} | D9 end mean={mean_end:+.2%} median={median_end:+.2%} win={win_end:.1%}")


if __name__ == "__main__":
    main()
