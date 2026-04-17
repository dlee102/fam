#!/usr/bin/env python3
"""
5분봉 데이터에서 피처를 뽑아 승률 60% 이상 되는 필터 조합을 탐색.

진입: F (공개 시각 직후 첫 장중 5분봉 종가)
보유: 1~22 거래일 (장종 5분봉 종가 청산)

피처 후보
  - published hour (KST)
  - weekday (KST)
  - 직전1일 수익률
  - 직전5일 수익률
  - 이벤트일 수익률 (주의: 진입 이후와 겹칠 수 있음)
  - 거래량 비율 (이벤트일 / 20일 평균)
  - 종가 vs MA5 (전일)
  - 종가 vs MA20 (전일)
  - 시가 갭
  - open_to_anchor %
  - 진입일(anchor) 5분봉 종가 위치 (당일 high 대비)
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
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


def eod_features(eod_bars: list, ei: int) -> dict:
    out: dict = {}

    def cl(i: int) -> float | None:
        if 0 <= i < len(eod_bars):
            v = eod_bars[i].get("close")
            return float(v) if v is not None else None
        return None

    c_m1 = cl(ei - 1)
    c0 = cl(ei)
    if c_m1 and c0 and c_m1 > 0:
        out["event_day_ret"] = c0 / c_m1 - 1.0

    c_m2 = cl(ei - 2)
    if c_m2 and c_m1 and c_m2 > 0:
        out["ret_1d_pre"] = c_m1 / c_m2 - 1.0

    if ei >= 6:
        c_m6 = cl(ei - 6)
        if c_m6 and c_m1 and c_m6 > 0:
            out["ret_5d_pre"] = c_m1 / c_m6 - 1.0

    if ei >= 11:
        c_m11 = cl(ei - 11)
        if c_m11 and c_m1 and c_m11 > 0:
            out["ret_10d_pre"] = c_m1 / c_m11 - 1.0

    if ei >= 5:
        s5 = [cl(ei - 5 + k) for k in range(5)]
        if all(x and x > 0 for x in s5):
            ma5 = sum(s5) / 5.0
            out["close_vs_ma5"] = c_m1 / ma5 - 1.0 if c_m1 else None

    if ei >= 20:
        s20 = [cl(ei - 20 + k) for k in range(20)]
        if all(x and x > 0 for x in s20):
            ma20 = sum(s20) / 20.0
            out["close_vs_ma20"] = c_m1 / ma20 - 1.0 if c_m1 else None

    ev_vol = eod_bars[ei].get("volume", 0) or 0
    pre_vols = [b.get("volume", 0) or 0 for b in eod_bars[max(0, ei - 20):ei]]
    avg_vol = sum(pre_vols) / len(pre_vols) if pre_vols else 0
    if avg_vol > 0 and ev_vol:
        out["vol_ratio"] = float(ev_vol) / float(avg_vol)

    return out


def intra_features(all_intra: list, entry_bar: dict, entry_px: float, t_date: str) -> dict:
    out: dict = {}
    day_bars = [
        b for b in all_intra
        if isinstance(b.get("datetime"), str)
        and b["datetime"][:10] == t_date
        and _is_market_bar(b["datetime"])
    ]
    if not day_bars:
        return out
    day_bars.sort(key=lambda x: x["datetime"])

    day_high = max(float(b.get("high") or b.get("close") or 0) for b in day_bars)
    day_low = min(float(b.get("low") or b.get("close") or 9e18) for b in day_bars if float(b.get("low") or b.get("close") or 0) > 0)
    day_open = float(day_bars[0].get("open") or day_bars[0].get("close") or 0)
    day_close = float(day_bars[-1].get("close") or 0)

    if day_high > 0 and entry_px > 0:
        out["entry_vs_day_high"] = entry_px / day_high - 1.0

    if day_open > 0 and entry_px > 0:
        out["open_to_entry"] = entry_px / day_open - 1.0

    if day_high > day_low > 0:
        out["entry_in_range"] = (entry_px - day_low) / (day_high - day_low)

    total_vol = sum(b.get("volume") or 0 for b in day_bars)
    if total_vol > 0:
        out["day_volume"] = total_vol

    return out


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

        kst_dt = pu.replace(tzinfo=timezone.utc).astimezone(KST)
        pub_hour = kst_dt.hour
        pub_weekday = kst_dt.weekday()

        feat = {
            "ticker": ticker,
            "t0": t0_str,
            "entry_px": px_f,
            "pub_hour": pub_hour,
            "pub_weekday": pub_weekday,
        }
        feat.update(eod_features(eod, i0))
        feat.update(intra_features(all_intra, entry_bar, px_f, dk_f))

        rets = {}
        for h in HOLD_DAYS:
            si = idx_f + h
            if si >= len(eod):
                si = len(eod) - 1
            sd = str(eod[si]["date"])[:10]
            sp = last_intraday_session_close(all_intra, sd)
            if sp is not None and sp > 0:
                rets[h] = (sp - px_f) / px_f
        feat["rets"] = rets
        samples.append(feat)

    print(f"Total samples: {len(samples)}")
    if not samples:
        return

    for h in HOLD_DAYS:
        valid = [s for s in samples if h in s["rets"]]
        if not valid:
            continue
        wins = sum(1 for s in valid if s["rets"][h] > 0)
        wr = wins / len(valid)
        avg = sum(s["rets"][h] for s in valid) / len(valid)
        print(f"  hold={h:2d}d: n={len(valid)}, win_rate={wr:.1%}, avg={avg:+.2%}")

    print("\n=== 필터 탐색 (hold=18d, F진입) ===\n")
    h = 18
    valid = [s for s in samples if h in s["rets"]]
    if not valid:
        print("hold=18 데이터 없음")
        return

    def scan_threshold(feat_name, thresholds, direction=">="):
        results = []
        for th in thresholds:
            if direction == ">=":
                subset = [s for s in valid if s.get(feat_name) is not None and s[feat_name] >= th]
            else:
                subset = [s for s in valid if s.get(feat_name) is not None and s[feat_name] < th]
            if len(subset) < 30:
                continue
            wins = sum(1 for s in subset if s["rets"][h] > 0)
            wr = wins / len(subset)
            avg = sum(s["rets"][h] for s in subset) / len(subset)
            results.append((th, len(subset), wr, avg))
        return results

    feature_scans = {
        "pub_hour >=": ("pub_hour", [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], ">="),
        "pub_hour <": ("pub_hour", [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], "<"),
        "ret_1d_pre >=": ("ret_1d_pre", [-0.10, -0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05, 0.10], ">="),
        "ret_1d_pre <": ("ret_1d_pre", [-0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05], "<"),
        "ret_5d_pre >=": ("ret_5d_pre", [-0.10, -0.05, -0.03, 0, 0.03, 0.05, 0.10, 0.15, 0.20], ">="),
        "ret_5d_pre <": ("ret_5d_pre", [-0.10, -0.05, -0.03, 0, 0.03, 0.05, 0.10], "<"),
        "vol_ratio >=": ("vol_ratio", [0.5, 1.0, 1.5, 2.0, 3.0, 5.0], ">="),
        "vol_ratio <": ("vol_ratio", [0.5, 1.0, 1.5, 2.0, 3.0, 5.0], "<"),
        "close_vs_ma5 >=": ("close_vs_ma5", [-0.10, -0.05, -0.03, 0, 0.03, 0.05, 0.10], ">="),
        "close_vs_ma5 <": ("close_vs_ma5", [-0.10, -0.05, -0.03, 0, 0.03, 0.05, 0.10], "<"),
        "close_vs_ma20 >=": ("close_vs_ma20", [-0.10, -0.05, -0.03, 0, 0.03, 0.05, 0.10], ">="),
        "close_vs_ma20 <": ("close_vs_ma20", [-0.10, -0.05, -0.03, 0, 0.03, 0.05, 0.10], "<"),
        "open_to_entry >=": ("open_to_entry", [-0.10, -0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05], ">="),
        "open_to_entry <": ("open_to_entry", [-0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05], "<"),
        "entry_in_range >=": ("entry_in_range", [0.0, 0.2, 0.4, 0.5, 0.6, 0.8], ">="),
        "entry_in_range <": ("entry_in_range", [0.2, 0.4, 0.5, 0.6, 0.8, 1.0], "<"),
        "event_day_ret >=": ("event_day_ret", [-0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05, 0.10, 0.15], ">="),
        "event_day_ret <": ("event_day_ret", [-0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05], "<"),
        "ret_10d_pre >=": ("ret_10d_pre", [-0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20], ">="),
        "ret_10d_pre <": ("ret_10d_pre", [-0.10, -0.05, 0, 0.05, 0.10], "<"),
    }

    print(f"{'Filter':<30} {'Thresh':>8} {'n':>5} {'WinRate':>8} {'AvgRet':>8}")
    print("-" * 65)
    good_filters = []
    for label, (feat, ths, d) in feature_scans.items():
        res = scan_threshold(feat, ths, d)
        for (th, n, wr, avg) in res:
            if wr >= 0.55:
                marker = " ***" if wr >= 0.60 else " **" if wr >= 0.57 else ""
                print(f"{label:<30} {th:>8.3f} {n:>5} {wr:>7.1%} {avg:>+7.2%}{marker}")
                good_filters.append({"filter": label, "threshold": th, "n": n, "win_rate": wr, "avg_return": avg})

    print(f"\n=== 2-필터 조합 (hold=18d) ===\n")
    best_combos = []
    for i, f1 in enumerate(good_filters):
        for f2 in good_filters[i + 1:]:
            fn1, d1 = f1["filter"].rsplit(" ", 1)
            fn2, d2 = f2["filter"].rsplit(" ", 1)
            if fn1 == fn2:
                continue
            subset = []
            for s in valid:
                v1 = s.get(fn1)
                v2 = s.get(fn2)
                if v1 is None or v2 is None:
                    continue
                ok1 = (v1 >= f1["threshold"]) if d1 == ">=" else (v1 < f1["threshold"])
                ok2 = (v2 >= f2["threshold"]) if d2 == ">=" else (v2 < f2["threshold"])
                if ok1 and ok2:
                    subset.append(s)
            if len(subset) < 30:
                continue
            wins = sum(1 for s in subset if s["rets"][h] > 0)
            wr = wins / len(subset)
            avg = sum(s["rets"][h] for s in subset) / len(subset)
            if wr >= 0.58:
                best_combos.append({
                    "f1": f"{fn1} {d1} {f1['threshold']}",
                    "f2": f"{fn2} {d2} {f2['threshold']}",
                    "n": len(subset),
                    "win_rate": wr,
                    "avg_return": avg,
                })

    best_combos.sort(key=lambda x: (-x["win_rate"], -x["n"]))
    print(f"{'Filter1':<30} {'Filter2':<30} {'n':>5} {'WR':>7} {'AvgR':>8}")
    print("-" * 85)
    for c in best_combos[:30]:
        marker = " ***" if c["win_rate"] >= 0.60 else ""
        print(f"{c['f1']:<30} {c['f2']:<30} {c['n']:>5} {c['win_rate']:>6.1%} {c['avg_return']:>+7.2%}{marker}")

    all_holds_scan = {}
    for hh in HOLD_DAYS:
        vv = [s for s in samples if hh in s["rets"]]
        if not vv:
            continue
        best_single = {"h": hh}
        for label, (feat, ths, d) in feature_scans.items():
            for th in ths:
                if d == ">=":
                    sub = [s for s in vv if s.get(feat) is not None and s[feat] >= th]
                else:
                    sub = [s for s in vv if s.get(feat) is not None and s[feat] < th]
                if len(sub) < 30:
                    continue
                w = sum(1 for s in sub if s["rets"][hh] > 0)
                wr = w / len(sub)
                if wr > best_single.get("wr", 0):
                    best_single = {"h": hh, "filter": label, "th": th, "n": len(sub), "wr": wr}
        all_holds_scan[hh] = best_single

    print(f"\n=== 보유기간별 Best Single Filter ===\n")
    for hh in HOLD_DAYS:
        bs = all_holds_scan.get(hh)
        if bs and "filter" in bs:
            print(f"hold={hh:2d}d: {bs['filter']:<30} th={bs['th']:>8.3f} n={bs['n']:>5} wr={bs['wr']:.1%}")

    out_path = ROOT / "data" / "analysis" / "algo_filter_scan.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "good_single_filters_hold18": good_filters,
            "best_combos_hold18": best_combos[:30],
            "best_single_per_hold": all_holds_scan,
        }, f, ensure_ascii=False, indent=2, default=str)
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    run()
