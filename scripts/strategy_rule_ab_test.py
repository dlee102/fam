#!/usr/bin/env python3
"""
뉴스 이벤트 표본에서 사용자 제안 3규칙의 A/B 요약 (실데이터).

규칙 (모두 관측 정의를 코드로 고정):
1) 이격도: T0 거래일 장중 첫 5분봉 시가 → 마지막 5분봉 종가 당일 수익률 >= 10% 이면 '급등일'.
2) 지지: T0 직전 거래일 EOD 일봉 저가(데이터에 있는 low) 대비, 진입 C 가격까지의 상승폭을
   (px_c - prior_low) / px_c 로 두고, 이 값이 0~3% 이면 '저점 근접(스탑 짧음)'.
3) 거래량: T0 당일 5분봉 거래량 합 / 직전 20거래일(가능하면) 동일 방식 일 합의 평균 >= 3배면 '폭증'.

결과 변수: 진입 C, 보유 1거래일 수익률 (entry_hold_analysis 와 동일 정의).

출력: 각 규칙별 두 집단 평균·승률·n, 평균차에 대한 부트스트랩 95% 구간(재현용 seed 고정).
다중 비교·표본 편향에 주의 — p-value 대신 효과크기+CI 위주로 해석.
"""

from __future__ import annotations

import json
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
EODHD_WINDOWS = BASE / "data" / "eodhd_news_windows"
OUT_JSON = BASE / "data" / "strategy_ab_test.json"

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import entry_hold_analysis as eh  # noqa: E402
from excluded_tickers import is_excluded  # noqa: E402
from news_article_events import (  # noqa: E402
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)


def sum_session_volume_5m(all_intra: list, ymd: str) -> float:
    day = eh._day_session_bars(all_intra, ymd[:10])
    return sum(float(b.get("volume") or 0) for b in day)


def t0_session_intra_return(all_intra: list, t0_date: str) -> float | None:
    day = eh._day_session_bars(all_intra, t0_date[:10])
    if not day:
        return None
    day.sort(key=lambda x: x["datetime"])
    o = float(day[0].get("open") or day[0].get("close") or 0)
    lc = float(day[-1].get("close") or day[-1].get("open") or 0)
    if o <= 0 or lc <= 0:
        return None
    return (lc - o) / o


def mean_prior_daily_vol_5m(all_intra: list, eod_bars: list, i0: int, lookback: int = 20) -> float | None:
    start = max(0, i0 - lookback)
    sums: list[float] = []
    for j in range(start, i0):
        d = str(eod_bars[j].get("date", ""))[:10]
        if not d:
            continue
        s = sum_session_volume_5m(all_intra, d)
        if s > 0:
            sums.append(s)
    if not sums:
        return None
    return sum(sums) / len(sums)


def prior_eod_low(eod_bars: list, i0: int) -> float | None:
    if i0 < 1:
        return None
    lo = float(eod_bars[i0 - 1].get("low") or 0)
    return lo if lo > 0 else None


def risk_c_to_prior_low(px_c: float, prior_low: float | None) -> float | None:
    if prior_low is None or px_c <= 0 or px_c <= prior_low:
        return None
    return (px_c - prior_low) / px_c


@dataclass
class Row:
    r_c1: float
    t0_day_ret: float | None
    vol_ratio: float | None
    risk_c: float | None


def summarize(xs: list[float]) -> dict:
    if not xs:
        return {"n": 0, "mean_pct": None, "win_rate": None}
    return {
        "n": len(xs),
        "mean_pct": round(sum(xs) / len(xs) * 100, 4),
        "win_rate": round(sum(1 for x in xs if x > 0) / len(xs), 4),
    }


def bootstrap_mean_diff(
    a: list[float],
    b: list[float],
    *,
    n_boot: int = 3000,
    seed: int = 42,
) -> tuple[float, float, float]:
    """return (point_diff_pct, lo_pct, hi_pct) for mean(a)-mean(b) in percentage points."""
    rng = random.Random(seed)
    if not a or not b:
        return float("nan"), float("nan"), float("nan")
    ma = sum(a) / len(a)
    mb = sum(b) / len(b)
    point = (ma - mb) * 100
    diffs: list[float] = []
    for _ in range(n_boot):
        sa = [rng.choice(a) for _ in a]
        sb = [rng.choice(b) for _ in b]
        diffs.append((sum(sa) / len(sa) - sum(sb) / len(sb)) * 100)
    diffs.sort()
    lo = diffs[int(0.025 * n_boot)]
    hi = diffs[int(0.975 * n_boot)]
    return point, lo, hi


def run() -> None:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음")
        return
    articles_path = default_articles_path(BASE)
    if not articles_path.is_file():
        print("기사 파일 없음")
        return

    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    rows: list[Row] = []

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
        if not eh.valid_ticker(ticker) or is_excluded(ticker):
            continue
        if not (EODHD_WINDOWS / eod_rel).is_file() or not (EODHD_WINDOWS / rel).is_file():
            continue

        bars = eh._cached_eod_bars(eod_rel)
        t0_d = date.fromisoformat(t0_str)
        i0 = eh.eod_index_on_or_after(bars, t0_d)
        if i0 is None or i0 + 2 >= len(bars):
            continue

        all_intra = eh._cached_intra_bars(rel)
        t0_date = bars[i0]["date"]
        t1_date = bars[i0 + 1]["date"]

        px_c = eh.last_intraday_session_close(all_intra, t1_date)
        if px_c is None or px_c <= 0:
            continue

        si = i0 + 2

        def sell_px(sell_i: int) -> float | None:
            if sell_i >= len(bars):
                return None
            sd = bars[sell_i]["date"]
            return eh.last_intraday_session_close(all_intra, sd)

        sp = sell_px(si)
        if sp is None:
            continue
        r_c1 = (sp - px_c) / px_c

        t0ret = t0_session_intra_return(all_intra, str(t0_date))
        vavg = mean_prior_daily_vol_5m(all_intra, bars, i0, 20)
        v0 = sum_session_volume_5m(all_intra, str(t0_date))
        vol_ratio = (v0 / vavg) if vavg and vavg > 0 else None

        plow = prior_eod_low(bars, i0)
        risk_c = risk_c_to_prior_low(px_c, plow)

        rows.append(Row(r_c1=r_c1, t0_day_ret=t0ret, vol_ratio=vol_ratio, risk_c=risk_c))

    # --- Rule 1: T0 day >= 10% vs < 10%
    r1_hi = [r.r_c1 for r in rows if r.t0_day_ret is not None and r.t0_day_ret >= 0.10]
    r1_lo = [r.r_c1 for r in rows if r.t0_day_ret is not None and r.t0_day_ret < 0.10]
    d1_pt, d1_lo, d1_hi = bootstrap_mean_diff(r1_hi, r1_lo)

    # --- Rule 2: tight support vs rest (among risk_c defined)
    r2_tight = [r.r_c1 for r in rows if r.risk_c is not None and 0 < r.risk_c <= 0.03]
    r2_loose = [r.r_c1 for r in rows if r.risk_c is not None and r.risk_c > 0.03]
    d2_pt, d2_lo, d2_hi = bootstrap_mean_diff(r2_tight, r2_loose)

    # --- Rule 3: vol ratio >= 3 vs < 3
    r3_hi = [r.r_c1 for r in rows if r.vol_ratio is not None and r.vol_ratio >= 3.0]
    r3_lo = [r.r_c1 for r in rows if r.vol_ratio is not None and r.vol_ratio < 3.0]
    d3_pt, d3_lo, d3_hi = bootstrap_mean_diff(r3_hi, r3_lo)

    out = {
        "generated_at": datetime.now().isoformat(),
        "outcome": "진입 C, 보유 1거래일 수익률 (단위: 소수, 출력은 %)",
        "n_events": len(rows),
        "rules": {
            "t0_day_move_ge_10pct": {
                "description": "T0 당일 장중 시가→종가(5분봉) >= 10%",
                "high_move": summarize(r1_hi),
                "low_move": summarize(r1_lo),
                "diff_mean_pct_high_minus_low": round(d1_pt, 4),
                "bootstrap_95ci_diff_pct": [round(d1_lo, 4), round(d1_hi, 4)],
                "interpretation_hint": "양수면 '급등일' 쪽 C·1일 평균이 더 큼",
            },
            "prior_low_within_3pct_of_C": {
                "description": "(C진입가 - 전일 EOD 저가) / C진입가 가 (0, 3%]",
                "tight": summarize(r2_tight),
                "loose": summarize(r2_loose),
                "diff_mean_pct_tight_minus_loose": round(d2_pt, 4),
                "bootstrap_95ci_diff_pct": [round(d2_lo, 4), round(d2_hi, 4)],
                "interpretation_hint": "양수면 저점 근접 집단이 C·1일 평균이 더 큼",
            },
            "t0_volume_ge_3x_20d_avg": {
                "description": "T0 5분봉 거래량 합 / 직전 20거래일 일별 5분봉 합 평균 >= 3",
                "high_vol": summarize(r3_hi),
                "low_vol": summarize(r3_lo),
                "diff_mean_pct_high_minus_low": round(d3_pt, 4),
                "bootstrap_95ci_diff_pct": [round(d3_lo, 4), round(d3_hi, 4)],
                "interpretation_hint": "양수면 고거래량 집단이 C·1일 평균이 더 큼",
            },
        },
        "caveats": [
            "동일 티커·다 기사 중복 표본 포함 가능.",
            "3가지 규칙 동시 검정 → 다중비교로 우연한 유의 차 가능성 증가.",
            "전일 저가·거래량 정의는 데이터 가용 범위에 의존.",
        ],
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\nSaved {OUT_JSON}")


if __name__ == "__main__":
    run()
