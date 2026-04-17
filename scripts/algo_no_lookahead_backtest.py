#!/usr/bin/env python3
"""
Look-ahead bias 없는 F 진입 알고리즘 백테스트.

모든 피처는 진입 시점에 이미 확정된 값만 사용.

전략:
  S1: pub_hour < 8  (장 전 기사)
  S2: close_vs_ma20 < 0 & pub_hour < 8  (MA20 이격 음 + 장 전)
  S3: close_vs_ma20 < -0.07 & pub_hour < 8  (MA20 이격 큰 하락 + 장 전)
  S4: close_vs_ma20 < 0 & gap_open_pct < -0.02  (MA20 이격 음 + 갭 하락)
  S5: pub_hour < 8 & ret_1d_pre < -0.02  (장 전 + 전일 하락)
  S6: entry_vs_prev_low < -0.03  (진입가 < 전일 저가 -3%)
  S7: entry_vs_prev_close < -0.07 & entry_vs_prev_low < -0.03  (진입가 크게 하락)
  baseline: 필터 없음

출력: data/analysis/algo_no_lookahead_backtest.json

사용:
    python3 scripts/algo_no_lookahead_backtest.py
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from entry_hold_analysis import (
    _cached_eod_bars,
    _cached_intra_bars,
    eod_index_for_session_ymd,
    eod_index_on_or_after,
    first_close_after_publish_bar_info,
    first_intraday_session_open,
    last_intraday_session_close,
    valid_ticker,
)
from excluded_tickers import is_excluded
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)
from analyze_10m_return_path import parse_publish_utc_naive

EODHD_WINDOWS = ROOT / "data" / "eodhd_news_windows"
KST = ZoneInfo("Asia/Seoul")
HOLD_DAYS = [1, 2, 3, 5, 10, 15, 18, 22]


def run() -> None:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음")
        return
    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        print("기사 파일 없음:", articles_path)
        return
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    samples: list[dict] = []

    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True,
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

        eod = _cached_eod_bars(eod_rel)
        t0_d = date.fromisoformat(t0_str)
        i0 = eod_index_on_or_after(eod, t0_d)
        if i0 is None or i0 + 1 >= len(eod):
            continue

        all_intra = _cached_intra_bars(rel)
        pa = ev.get("published_at")
        if not isinstance(pa, str) or not pa.strip():
            continue
        try:
            pu = parse_publish_utc_naive(pa.strip())
        except (ValueError, TypeError):
            continue

        finfo = first_close_after_publish_bar_info(all_intra, t0_d, pu)
        if finfo is None:
            continue
        px_f, dk_f, entry_bar = finfo
        idx_f = eod_index_for_session_ymd(eod, dk_f)
        if idx_f is None or px_f <= 0:
            continue

        def cl(i: int) -> float | None:
            if 0 <= i < len(eod):
                v = eod[i].get("close")
                return float(v) if v is not None else None
            return None

        def hi(i: int) -> float | None:
            if 0 <= i < len(eod):
                v = eod[i].get("high")
                return float(v) if v is not None else None
            return None

        def lo(i: int) -> float | None:
            if 0 <= i < len(eod):
                v = eod[i].get("low")
                return float(v) if v is not None else None
            return None

        c_m1 = cl(i0 - 1)
        c_m2 = cl(i0 - 2)
        l_m1 = lo(i0 - 1)
        if not c_m1 or c_m1 <= 0:
            continue

        kst_dt = pu.replace(tzinfo=timezone.utc).astimezone(KST)
        feat: dict = {"ticker": ticker, "t0": t0_str, "entry_px": px_f}

        feat["pub_hour"] = kst_dt.hour

        feat["entry_vs_prev_close"] = px_f / c_m1 - 1.0
        if l_m1 and l_m1 > 0:
            feat["entry_vs_prev_low"] = px_f / l_m1 - 1.0

        if c_m2 and c_m2 > 0:
            feat["ret_1d_pre"] = c_m1 / c_m2 - 1.0

        if i0 >= 20:
            s20 = [cl(i0 - 20 + k) for k in range(20)]
            if all(x and x > 0 for x in s20):
                feat["close_vs_ma20"] = c_m1 / (sum(s20) / 20.0) - 1.0

        t0_date = str(eod[i0]["date"])[:10]
        day_open = first_intraday_session_open(all_intra, t0_date)
        if day_open and day_open > 0:
            feat["gap_open_pct"] = day_open / c_m1 - 1.0

        rets: dict[int, float] = {}
        for h in HOLD_DAYS:
            si = min(idx_f + h, len(eod) - 1)
            sd = str(eod[si]["date"])[:10]
            sp = last_intraday_session_close(all_intra, sd)
            if sp is not None and sp > 0:
                rets[h] = (sp - px_f) / px_f
        feat["rets"] = rets
        samples.append(feat)

    print(f"Total F-entry samples: {len(samples)}")

    strategies = {
        "baseline": lambda s: True,
        "S1_pre_market": lambda s: s.get("pub_hour", 99) < 8,
        "S2_ma20_neg_pre": lambda s: (
            s.get("close_vs_ma20") is not None
            and s["close_vs_ma20"] < 0
            and s.get("pub_hour", 99) < 8
        ),
        "S3_ma20_deep_pre": lambda s: (
            s.get("close_vs_ma20") is not None
            and s["close_vs_ma20"] < -0.07
            and s.get("pub_hour", 99) < 8
        ),
        "S4_ma20_neg_gap_down": lambda s: (
            s.get("close_vs_ma20") is not None
            and s["close_vs_ma20"] < 0
            and s.get("gap_open_pct") is not None
            and s["gap_open_pct"] < -0.02
        ),
        "S5_pre_ret1d_neg": lambda s: (
            s.get("pub_hour", 99) < 8
            and s.get("ret_1d_pre") is not None
            and s["ret_1d_pre"] < -0.02
        ),
        "S6_below_prev_low": lambda s: (
            s.get("entry_vs_prev_low") is not None
            and s["entry_vs_prev_low"] < -0.03
        ),
        "S7_deep_drop_entry": lambda s: (
            s.get("entry_vs_prev_close") is not None
            and s["entry_vs_prev_close"] < -0.07
            and s.get("entry_vs_prev_low") is not None
            and s["entry_vs_prev_low"] < -0.03
        ),
    }

    results: dict[str, dict] = {}

    for sname, filt in strategies.items():
        subset = [s for s in samples if filt(s)]
        sr: dict = {"n_total": len(subset), "by_hold": {}}
        for h in HOLD_DAYS:
            valid = [s for s in subset if h in s["rets"]]
            if not valid:
                continue
            rets_list = [s["rets"][h] for s in valid]
            wins = sum(1 for r in rets_list if r > 0)
            pos = [r for r in rets_list if r > 0]
            neg = [r for r in rets_list if r < 0]
            sr["by_hold"][str(h)] = {
                "n": len(valid),
                "win_rate": round(wins / len(valid), 4),
                "avg_return_pct": round(sum(rets_list) / len(valid) * 100, 2),
                "avg_win_pct": round(sum(pos) / len(pos) * 100, 2) if pos else 0,
                "avg_loss_pct": round(sum(neg) / len(neg) * 100, 2) if neg else 0,
                "max_win_pct": round(max(rets_list) * 100, 2),
                "max_loss_pct": round(min(rets_list) * 100, 2),
            }
        results[sname] = sr

    print()
    for sname, sr in results.items():
        print(f"=== {sname} (n={sr['n_total']}) ===")
        print(f"  {'hold':>5} {'n':>5} {'WR':>7} {'avg':>8} {'avg_w':>8} {'avg_l':>8}")
        for h in HOLD_DAYS:
            hk = str(h)
            if hk not in sr["by_hold"]:
                continue
            d = sr["by_hold"][hk]
            print(
                f"  {h:>5}d {d['n']:>5} {d['win_rate']:>6.1%} "
                f"{d['avg_return_pct']:>+7.2f}% "
                f"{d['avg_win_pct']:>+7.2f}% "
                f"{d['avg_loss_pct']:>+7.2f}%"
            )
        print()

    out_path = ROOT / "data" / "analysis" / "algo_no_lookahead_backtest.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "generated_at": datetime.now().isoformat(),
        "methodology": (
            "F진입(유료 기사 공개 직후 첫 장중 5분봉 종가). "
            "모든 피처는 진입 시점에 이미 확정된 값만 사용(look-ahead 없음). "
            "pub_hour: 기사 공개 시각(KST). "
            "close_vs_ma20: 전일 종가 / 20일 이평 − 1. "
            "gap_open_pct: 당일 시가 / 전일 종가 − 1. "
            "ret_1d_pre: 전전일→전일 종가 수익률. "
            "entry_vs_prev_close: F진입가 / 전일 종가 − 1. "
            "entry_vs_prev_low: F진입가 / 전일 저가 − 1. "
            "청산: 진입 기준 N거래일 뒤 장종 5분봉 종가."
        ),
        "strategies": results,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    run()
