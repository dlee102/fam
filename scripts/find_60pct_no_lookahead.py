#!/usr/bin/env python3
"""
Look-ahead bias 없이 F 진입 시점에 이미 알 수 있는 피처만으로 승률 60%+ 필터를 탐색.

사용 가능한 피처 (진입 '이전'에 확정):
  - pub_hour         : 기사 공개 시각 (KST)
  - pub_weekday      : 기사 공개 요일 (0=월 … 4=금)
  - ret_1d_pre       : 전일 수익률 (T-2종가 → T-1종가)
  - ret_5d_pre       : 직전5거래일 수익률
  - ret_10d_pre      : 직전10거래일 수익률
  - close_vs_ma5     : 전일 종가 / MA5 − 1
  - close_vs_ma20    : 전일 종가 / MA20 − 1
  - prev_vol_ratio   : 전일 거래량 / 20일 평균 거래량 (이벤트일 아님)
  - entry_vs_prev_close : F진입가 / 전일종가 − 1  (진입 봉이 확정되는 순간 알 수 있음)
  - entry_vs_prev_high  : F진입가 / 전일고가 − 1
  - entry_vs_prev_low   : F진입가 / 전일저가 − 1
  - prev_day_range_pct  : (전일고 − 전일저) / 전일종가  (전일 변동성)
  - gap_open_pct     : 당일시가 / 전일종가 − 1  (갭; 시가는 F 이전에 확정)

출력: data/analysis/algo_no_lookahead_scan.json
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

        def vol(i: int) -> float:
            if 0 <= i < len(eod):
                return float(eod[i].get("volume") or 0)
            return 0

        c_m1 = cl(i0 - 1)
        c_m2 = cl(i0 - 2)
        h_m1 = hi(i0 - 1)
        l_m1 = lo(i0 - 1)

        if not c_m1 or c_m1 <= 0:
            continue

        feat: dict = {"ticker": ticker, "t0": t0_str, "entry_px": px_f}

        kst_dt = pu.replace(tzinfo=timezone.utc).astimezone(KST)
        feat["pub_hour"] = kst_dt.hour
        feat["pub_weekday"] = kst_dt.weekday()

        if c_m2 and c_m2 > 0:
            feat["ret_1d_pre"] = c_m1 / c_m2 - 1.0

        if i0 >= 6:
            c_m6 = cl(i0 - 6)
            if c_m6 and c_m6 > 0:
                feat["ret_5d_pre"] = c_m1 / c_m6 - 1.0

        if i0 >= 11:
            c_m11 = cl(i0 - 11)
            if c_m11 and c_m11 > 0:
                feat["ret_10d_pre"] = c_m1 / c_m11 - 1.0

        if i0 >= 5:
            s5 = [cl(i0 - 5 + k) for k in range(5)]
            if all(x and x > 0 for x in s5):
                feat["close_vs_ma5"] = c_m1 / (sum(s5) / 5.0) - 1.0

        if i0 >= 20:
            s20 = [cl(i0 - 20 + k) for k in range(20)]
            if all(x and x > 0 for x in s20):
                feat["close_vs_ma20"] = c_m1 / (sum(s20) / 20.0) - 1.0

        pre_vols = [vol(i0 - 1 - k) for k in range(min(20, i0))]
        if len(pre_vols) >= 5:
            avg_prev_vol = sum(pre_vols[1:]) / len(pre_vols[1:])
            if avg_prev_vol > 0 and pre_vols[0] > 0:
                feat["prev_vol_ratio"] = pre_vols[0] / avg_prev_vol

        feat["entry_vs_prev_close"] = px_f / c_m1 - 1.0

        if h_m1 and h_m1 > 0:
            feat["entry_vs_prev_high"] = px_f / h_m1 - 1.0
        if l_m1 and l_m1 > 0:
            feat["entry_vs_prev_low"] = px_f / l_m1 - 1.0
        if h_m1 and l_m1 and c_m1 and c_m1 > 0:
            feat["prev_day_range_pct"] = (h_m1 - l_m1) / c_m1

        t0_date = str(eod[i0]["date"])[:10]
        day_open = first_intraday_session_open(all_intra, t0_date)
        if day_open and day_open > 0:
            feat["gap_open_pct"] = day_open / c_m1 - 1.0

        rets = {}
        for h in HOLD_DAYS:
            si = min(idx_f + h, len(eod) - 1)
            sd = str(eod[si]["date"])[:10]
            sp = last_intraday_session_close(all_intra, sd)
            if sp is not None and sp > 0:
                rets[h] = (sp - px_f) / px_f
        feat["rets"] = rets
        samples.append(feat)

    print(f"Total F-entry samples: {len(samples)}")
    if not samples:
        return

    for h in HOLD_DAYS:
        valid = [s for s in samples if h in s["rets"]]
        if not valid:
            continue
        wins = sum(1 for s in valid if s["rets"][h] > 0)
        wr = wins / len(valid)
        avg = sum(s["rets"][h] for s in valid) / len(valid)
        print(f"  baseline hold={h:2d}d: n={len(valid)}, wr={wr:.1%}, avg={avg:+.2%}")

    feature_scans = {
        "ret_1d_pre": [-0.10, -0.07, -0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05, 0.10],
        "ret_5d_pre": [-0.15, -0.10, -0.07, -0.05, -0.03, 0, 0.03, 0.05, 0.10, 0.15, 0.20],
        "ret_10d_pre": [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20],
        "close_vs_ma5": [-0.10, -0.07, -0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05, 0.10],
        "close_vs_ma20": [-0.15, -0.10, -0.07, -0.05, -0.03, 0, 0.03, 0.05, 0.10],
        "prev_vol_ratio": [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0],
        "entry_vs_prev_close": [-0.15, -0.10, -0.07, -0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05, 0.10],
        "entry_vs_prev_high": [-0.15, -0.10, -0.07, -0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05],
        "entry_vs_prev_low": [-0.10, -0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05, 0.10, 0.15],
        "prev_day_range_pct": [0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15],
        "gap_open_pct": [-0.10, -0.07, -0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05],
        "pub_hour": [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    }

    all_good: dict[int, list[dict]] = {h: [] for h in HOLD_DAYS}

    for h in HOLD_DAYS:
        valid = [s for s in samples if h in s["rets"]]
        if not valid:
            continue
        for feat_name, thresholds in feature_scans.items():
            for th in thresholds:
                for d in (">=", "<"):
                    if d == ">=":
                        sub = [s for s in valid if s.get(feat_name) is not None and s[feat_name] >= th]
                    else:
                        sub = [s for s in valid if s.get(feat_name) is not None and s[feat_name] < th]
                    if len(sub) < 30:
                        continue
                    wins = sum(1 for s in sub if s["rets"][h] > 0)
                    wr = wins / len(sub)
                    avg_r = sum(s["rets"][h] for s in sub) / len(sub)
                    if wr >= 0.55:
                        all_good[h].append({
                            "feat": feat_name, "dir": d, "th": th,
                            "n": len(sub), "wr": wr, "avg": avg_r,
                        })

    print("\n=== 단일 필터 승률 55%+ (hold별 best) ===\n")
    for h in HOLD_DAYS:
        if not all_good[h]:
            print(f"  hold={h:2d}d: (없음)")
            continue
        top = sorted(all_good[h], key=lambda x: (-x["wr"], -x["n"]))[:5]
        for t in top:
            marker = " ***" if t["wr"] >= 0.60 else ""
            print(f"  hold={h:2d}d: {t['feat']:<22} {t['dir']} {t['th']:>8.3f}  n={t['n']:>5}  wr={t['wr']:.1%}  avg={t['avg']:+.2%}{marker}")

    print("\n=== 2-필터 조합 (hold=1d~5d, 승률 58%+, n≥30) ===\n")
    combo_results: dict[int, list[dict]] = {}
    for h in [1, 2, 3, 5]:
        valid = [s for s in samples if h in s["rets"]]
        if not valid:
            continue
        tops = sorted(all_good[h], key=lambda x: (-x["wr"], -x["n"]))[:20]
        combos = []
        for i, f1 in enumerate(tops):
            for f2 in tops[i + 1:]:
                if f1["feat"] == f2["feat"]:
                    continue
                sub = []
                for s in valid:
                    v1 = s.get(f1["feat"])
                    v2 = s.get(f2["feat"])
                    if v1 is None or v2 is None:
                        continue
                    ok1 = (v1 >= f1["th"]) if f1["dir"] == ">=" else (v1 < f1["th"])
                    ok2 = (v2 >= f2["th"]) if f2["dir"] == ">=" else (v2 < f2["th"])
                    if ok1 and ok2:
                        sub.append(s)
                if len(sub) < 30:
                    continue
                w = sum(1 for s in sub if s["rets"][h] > 0)
                wr = w / len(sub)
                avg_r = sum(s["rets"][h] for s in sub) / len(sub)
                if wr >= 0.58:
                    combos.append({
                        "f1": f"{f1['feat']} {f1['dir']} {f1['th']}",
                        "f2": f"{f2['feat']} {f2['dir']} {f2['th']}",
                        "n": len(sub), "wr": wr, "avg": avg_r,
                    })
        combos.sort(key=lambda x: (-x["wr"], -x["n"]))
        combo_results[h] = combos[:15]
        print(f"--- hold={h}d ---")
        if not combos:
            print("  (58%+ 없음)")
        for c in combos[:15]:
            marker = " ***" if c["wr"] >= 0.60 else ""
            print(f"  {c['f1']:<35} & {c['f2']:<35} n={c['n']:>4} wr={c['wr']:.1%} avg={c['avg']:+.2%}{marker}")
        print()

    print("\n=== 3-필터 조합 (hold=1d, 승률 60%+, n≥30) ===\n")
    h = 1
    valid = [s for s in samples if h in s["rets"]]
    tops1 = sorted(all_good.get(h, []), key=lambda x: (-x["wr"], -x["n"]))[:15]
    triple_combos = []
    for i, f1 in enumerate(tops1):
        for j, f2 in enumerate(tops1[i+1:], i+1):
            if f1["feat"] == f2["feat"]:
                continue
            for f3 in tops1[j+1:]:
                if f3["feat"] in (f1["feat"], f2["feat"]):
                    continue
                sub = []
                for s in valid:
                    v1 = s.get(f1["feat"])
                    v2 = s.get(f2["feat"])
                    v3 = s.get(f3["feat"])
                    if v1 is None or v2 is None or v3 is None:
                        continue
                    ok1 = (v1 >= f1["th"]) if f1["dir"] == ">=" else (v1 < f1["th"])
                    ok2 = (v2 >= f2["th"]) if f2["dir"] == ">=" else (v2 < f2["th"])
                    ok3 = (v3 >= f3["th"]) if f3["dir"] == ">=" else (v3 < f3["th"])
                    if ok1 and ok2 and ok3:
                        sub.append(s)
                if len(sub) < 30:
                    continue
                w = sum(1 for s in sub if s["rets"][h] > 0)
                wr = w / len(sub)
                avg_r = sum(s["rets"][h] for s in sub) / len(sub)
                if wr >= 0.60:
                    triple_combos.append({
                        "f1": f"{f1['feat']} {f1['dir']} {f1['th']}",
                        "f2": f"{f2['feat']} {f2['dir']} {f2['th']}",
                        "f3": f"{f3['feat']} {f3['dir']} {f3['th']}",
                        "n": len(sub), "wr": wr, "avg": avg_r,
                    })
    triple_combos.sort(key=lambda x: (-x["wr"], -x["n"]))
    for c in triple_combos[:20]:
        print(f"  {c['f1']:<30} & {c['f2']:<30} & {c['f3']:<30} n={c['n']:>4} wr={c['wr']:.1%} avg={c['avg']:+.2%}")
    if not triple_combos:
        print("  (60%+ 없음)")

    out_path = ROOT / "data" / "analysis" / "algo_no_lookahead_scan.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "generated_at": datetime.now().isoformat(),
        "note": "look-ahead bias 없음. 모든 피처는 F 진입 시점에 이미 확정된 값만 사용.",
        "single_filters_by_hold": {
            str(h): sorted(all_good[h], key=lambda x: (-x["wr"], -x["n"]))[:20]
            for h in HOLD_DAYS if all_good[h]
        },
        "combo_2_filters": {str(k): v for k, v in combo_results.items() if v},
        "combo_3_filters_hold1": triple_combos[:20],
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, default=str)
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    run()
