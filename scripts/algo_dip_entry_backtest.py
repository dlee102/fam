#!/usr/bin/env python3
"""
저점 진입(Dip-Entry) 알고리즘 백테스트

핵심 아이디어:
  유료 기사 공개 시점의 첫 5분봉 종가(F 진입)가 **해당 거래일 고가·저가 레인지의 하단 20% 이내**이면 진입.
  → "기사가 떴지만 장중 저점 근처에서 잡힌 경우" 만 매수.

청산: 진입 후 1~22거래일 장종 5분봉 종가.

추가 서브필터:
  - Strategy A: entry_in_range < 0.20 (기본)
  - Strategy B: entry_in_range < 0.10 (더 타이트)
  - Strategy C: entry_in_range < 0.20 AND ret_1d_pre < -0.01 (전일 하락 후 저점 진입)
  - Strategy D: entry_in_range < 0.20 AND ret_1d_pre < -0.03 (전일 -3% 이상 하락 후 저점)

출력: data/analysis/algo_dip_entry_backtest.json

사용:
    python3 scripts/algo_dip_entry_backtest.py
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
    _is_market_bar,
    eod_index_for_session_ymd,
    eod_index_on_or_after,
    first_close_after_publish_bar_info,
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

        day_bars = [
            b for b in all_intra
            if isinstance(b.get("datetime"), str)
            and b["datetime"][:10] == dk_f
            and _is_market_bar(b["datetime"])
        ]
        if not day_bars:
            continue

        day_high = max(float(b.get("high") or b.get("close") or 0) for b in day_bars)
        day_low = min(
            float(b.get("low") or b.get("close") or 9e18)
            for b in day_bars
            if float(b.get("low") or b.get("close") or 0) > 0
        )
        if day_high <= day_low or day_high <= 0:
            continue

        entry_in_range = (px_f - day_low) / (day_high - day_low)

        def cl(i: int) -> float | None:
            if 0 <= i < len(eod):
                v = eod[i].get("close")
                return float(v) if v is not None else None
            return None

        c_m1 = cl(i0 - 1)
        c_m2 = cl(i0 - 2)
        ret_1d_pre = c_m1 / c_m2 - 1.0 if c_m1 and c_m2 and c_m2 > 0 else None

        rets: dict[int, float] = {}
        for h in HOLD_DAYS:
            si = min(idx_f + h, len(eod) - 1)
            sd = str(eod[si]["date"])[:10]
            sp = last_intraday_session_close(all_intra, sd)
            if sp is not None and sp > 0:
                rets[h] = (sp - px_f) / px_f

        kst_dt = pu.replace(tzinfo=timezone.utc).astimezone(KST)

        samples.append({
            "ticker": ticker,
            "t0": t0_str,
            "entry_px": px_f,
            "entry_in_range": entry_in_range,
            "ret_1d_pre": ret_1d_pre,
            "pub_hour": kst_dt.hour,
            "rets": rets,
        })

    print(f"Total F-entry samples: {len(samples)}")

    strategies = {
        "A_range020": lambda s: s["entry_in_range"] < 0.20,
        "B_range010": lambda s: s["entry_in_range"] < 0.10,
        "C_range020_ret1d_neg1pct": lambda s: (
            s["entry_in_range"] < 0.20
            and s.get("ret_1d_pre") is not None
            and s["ret_1d_pre"] < -0.01
        ),
        "D_range020_ret1d_neg3pct": lambda s: (
            s["entry_in_range"] < 0.20
            and s.get("ret_1d_pre") is not None
            and s["ret_1d_pre"] < -0.03
        ),
        "E_range005": lambda s: s["entry_in_range"] < 0.05,
        "baseline_all": lambda s: True,
    }

    results: dict[str, dict] = {}

    for sname, filt in strategies.items():
        subset = [s for s in samples if filt(s)]
        strat_result: dict = {"n_total": len(subset), "by_hold": {}}
        for h in HOLD_DAYS:
            valid = [s for s in subset if h in s["rets"]]
            if not valid:
                continue
            rets_list = [s["rets"][h] for s in valid]
            wins = sum(1 for r in rets_list if r > 0)
            pos = [r for r in rets_list if r > 0]
            neg = [r for r in rets_list if r < 0]
            strat_result["by_hold"][str(h)] = {
                "n": len(valid),
                "win_rate": round(wins / len(valid), 4),
                "avg_return_pct": round(sum(rets_list) / len(valid) * 100, 2),
                "avg_win_pct": round(sum(pos) / len(pos) * 100, 2) if pos else 0,
                "avg_loss_pct": round(sum(neg) / len(neg) * 100, 2) if neg else 0,
                "max_win_pct": round(max(rets_list) * 100, 2),
                "max_loss_pct": round(min(rets_list) * 100, 2),
            }
        results[sname] = strat_result

    print()
    for sname, sr in results.items():
        print(f"=== {sname} (n={sr['n_total']}) ===")
        print(f"  {'hold':>5} {'n':>5} {'WR':>7} {'avg':>8} {'avg_w':>8} {'avg_l':>8} {'max_w':>8} {'max_l':>8}")
        for h in HOLD_DAYS:
            hk = str(h)
            if hk not in sr["by_hold"]:
                continue
            d = sr["by_hold"][hk]
            print(
                f"  {h:>5}d {d['n']:>5} {d['win_rate']:>6.1%} "
                f"{d['avg_return_pct']:>+7.2f}% "
                f"{d['avg_win_pct']:>+7.2f}% "
                f"{d['avg_loss_pct']:>+7.2f}% "
                f"{d['max_win_pct']:>+7.2f}% "
                f"{d['max_loss_pct']:>+7.2f}%"
            )
        print()

    top_trades_A = [
        s for s in samples
        if s["entry_in_range"] < 0.20 and 1 in s["rets"]
    ]
    top_trades_A.sort(key=lambda s: s["rets"][1], reverse=True)
    print("=== Strategy A: Top 10 / Bottom 10 trades (hold=1d) ===")
    print(f"  {'ticker':>8} {'t0':>12} {'entry_px':>10} {'range%':>7} {'ret1d':>8} {'ret1d_pre':>10}")
    for s in top_trades_A[:10]:
        r1p = f"{s.get('ret_1d_pre', 0)*100:+.1f}%" if s.get("ret_1d_pre") is not None else "n/a"
        print(f"  {s['ticker']:>8} {s['t0']:>12} {s['entry_px']:>10.0f} {s['entry_in_range']:>6.1%} {s['rets'][1]*100:>+7.2f}% {r1p:>10}")
    print("  ...")
    for s in top_trades_A[-10:]:
        r1p = f"{s.get('ret_1d_pre', 0)*100:+.1f}%" if s.get("ret_1d_pre") is not None else "n/a"
        print(f"  {s['ticker']:>8} {s['t0']:>12} {s['entry_px']:>10.0f} {s['entry_in_range']:>6.1%} {s['rets'][1]*100:>+7.2f}% {r1p:>10}")

    out_path = ROOT / "data" / "analysis" / "algo_dip_entry_backtest.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "generated_at": datetime.now().isoformat(),
        "methodology": (
            "F진입(유료 기사 공개 직후 첫 장중 5분봉 종가). "
            "entry_in_range = (진입가 - 당일저가) / (당일고가 - 당일저가). "
            "청산: 진입 기준 N거래일 뒤 장종 5분봉 종가. "
            "ret_1d_pre = 이벤트일 직전거래일 수익률(T-2→T-1 종가). "
            "⚠ entry_in_range는 당일 고가·저가를 사후에 아는 look-ahead bias 포함."
        ),
        "strategies": results,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    run()
