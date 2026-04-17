#!/usr/bin/env python3
"""
유료 기사 × 종목 이벤트별 '룩어헤드 없음' 시그널 점수 (0~100).

`docs/algo_no_lookahead_backtest.md`·`algo_no_lookahead_backtest.py` 와 같은 피처 정의를 쓴다.
- 당일 전체 고저 기반 range 필터는 사용하지 않음.
- 앵커(F) 종가는 '봉 확정 후에만 아는 값' → 별도 축으로 표시.

점수 구성 (가중합 100):
  - 시간대(공개 시각 KST)     : 최대 15  — 장 전일수록 높음
  - 이평 이격(close_vs_ma20) : 최대 20  — 전일 종가가 MA20 아래로 많이 내려갈수록 높음(역추세 테마)
  - 전일 수익(ret_1d_pre)    : 최대 15  — 전일 하락폭이 클수록 높음
  - 갭(gap_open_pct)        : 최대 15  — 시가 갭하락이 클수록 높음 (앵커 세션 시가 vs 직전 거래일 종가)
  - 앵커 위치                : 최대 25  — F가 전일 종가·저가 대비 얼마나 아래인지(깊을수록 높음)
  - 전략 보너스              : 최대 10  — S4·S2 등 백테스트에서 강했던 조합과 겹칠 때 가산

출력: data/analysis/article_news_scores.json

사용:
    python3 scripts/article_news_score.py
    python3 scripts/article_news_score.py --limit 50
"""

from __future__ import annotations

import argparse
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
OUT_JSON = ROOT / "data" / "analysis" / "article_news_scores.json"


def _lin(x: float | None, x_bad: float, x_good: float, w_max: float) -> float:
    """x가 x_bad→x_good 구간으로 갈수록 w_max까지 선형 증가 (좋은 쪽=x_good)."""
    if x is None:
        return 0.0
    if x_bad == x_good:
        return 0.0
    t = (x - x_bad) / (x_good - x_bad)
    t = max(0.0, min(1.0, t))
    return round(w_max * t, 2)


def score_from_features(f: dict) -> dict:
    """
    f 키: pub_hour, close_vs_ma20, ret_1d_pre, gap_open_pct,
         entry_vs_prev_close, entry_vs_prev_low
    """
    ph = f.get("pub_hour")
    if ph is not None:
        if ph < 8:
            s_time = 15.0
        elif ph < 11:
            s_time = 10.0
        elif ph < 15:
            s_time = 5.0
        else:
            s_time = 0.0
    else:
        s_time = 0.0

    cv = f.get("close_vs_ma20")
    # +5% 위 = 0점, -10% 아래 = 만점 (역추세 쪽)
    s_ma = _lin(cv, 0.05, -0.10, 20.0)

    r1 = f.get("ret_1d_pre")
    # -8% = 만점, +3% = 0점
    s_r1 = _lin(r1, 0.03, -0.08, 15.0)

    gap = f.get("gap_open_pct")
    # 갭 +2% = 0, -5% = 만점
    s_gap = _lin(gap, 0.02, -0.05, 15.0)

    evc = f.get("entry_vs_prev_close")
    evl = f.get("entry_vs_prev_low")
    s_evc = _lin(evc, 0.02, -0.12, 12.5) if evc is not None else 0.0
    s_evl = _lin(evl, 0.0, -0.10, 12.5) if evl is not None else 0.0
    s_anchor = min(25.0, s_evc + s_evl)

    bonus = 0.0
    if cv is not None and gap is not None and cv < 0 and gap < -0.02:
        bonus += 5.0
    if ph is not None and ph < 8 and cv is not None and cv < 0:
        bonus += 3.0
    if ph is not None and ph < 8 and r1 is not None and r1 < -0.02:
        bonus += 2.0
    bonus = min(10.0, bonus)

    total = min(100.0, s_time + s_ma + s_r1 + s_gap + s_anchor + bonus)

    return {
        "score_total": round(total, 2),
        "breakdown": {
            "time_max15": s_time,
            "ma20_max20": s_ma,
            "ret1d_max15": s_r1,
            "gap_max15": s_gap,
            "anchor_max25": round(s_anchor, 2),
            "bonus_max10": bonus,
        },
        "flags": {
            "S1_pre_market": ph is not None and ph < 8,
            "S2_ma20_neg_pre": ph is not None and ph < 8 and cv is not None and cv < 0,
            "S4_ma20_gap": cv is not None and gap is not None and cv < 0 and gap < -0.02,
            "S5_pre_ret_neg": ph is not None and ph < 8 and r1 is not None and r1 < -0.02,
            "S6_below_prev_low": evl is not None and evl < -0.03,
            "S7_deep_drop": evc is not None and evl is not None and evc < -0.07 and evl < -0.03,
        },
    }


def extract_features_one(ev: dict) -> dict | None:
    """이벤트 1건에서 피처 dict 반환. 실패 시 None."""
    m = ev["manifest_row"]
    ticker = ev["ticker"]
    t0_str = ev["t0"]
    rel = m.get("intraday_path")
    eod_rel = m.get("eod_path")
    if not ticker or not t0_str or not rel or not eod_rel:
        return None
    if not valid_ticker(ticker) or is_excluded(ticker):
        return None

    eod = _cached_eod_bars(eod_rel)
    t0_d = date.fromisoformat(t0_str)
    i0 = eod_index_on_or_after(eod, t0_d)
    if i0 is None or i0 + 1 >= len(eod):
        return None

    all_intra = _cached_intra_bars(rel)
    pa = ev.get("published_at")
    if not isinstance(pa, str) or not pa.strip():
        return None
    try:
        pu = parse_publish_utc_naive(pa.strip())
    except (ValueError, TypeError):
        return None

    finfo = first_close_after_publish_bar_info(all_intra, t0_d, pu)
    if finfo is None:
        return None
    px_f, dk_f, _entry_bar = finfo
    idx_f = eod_index_for_session_ymd(eod, dk_f)
    if idx_f is None or px_f <= 0:
        return None

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
        return None

    kst_dt = pu.replace(tzinfo=timezone.utc).astimezone(KST)
    out: dict = {
        "pub_hour": kst_dt.hour,
        "entry_px": px_f,
        "entry_vs_prev_close": px_f / c_m1 - 1.0,
    }
    if l_m1 and l_m1 > 0:
        out["entry_vs_prev_low"] = px_f / l_m1 - 1.0

    if c_m2 and c_m2 > 0:
        out["ret_1d_pre"] = c_m1 / c_m2 - 1.0

    if i0 >= 20:
        s20 = [cl(i0 - 20 + k) for k in range(20)]
        if all(x and x > 0 for x in s20):
            out["close_vs_ma20"] = c_m1 / (sum(s20) / 20.0) - 1.0

    # 갭: 앵커가 잡힌 세션(dk_f) 시가 / 직전 거래일 종가 (미래 봉 미사용)
    if idx_f > 0:
        prev_close = cl(idx_f - 1)
    else:
        prev_close = None
    day_open = first_intraday_session_open(all_intra, dk_f)
    if prev_close and prev_close > 0 and day_open and day_open > 0:
        out["gap_open_pct"] = day_open / prev_close - 1.0

    return out


def run() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="0이면 전체")
    parser.add_argument("--no-json", action="store_true", help="stdout만")
    args = parser.parse_args()

    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음")
        return
    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        print("기사 파일 없음:", articles_path)
        return
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    rows: list[dict] = []
    n_skip = 0

    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True,
    ):
        feat = extract_features_one(ev)
        if feat is None:
            n_skip += 1
            continue
        sc = score_from_features(feat)
        mrow = ev.get("manifest_row") or {}
        aid = mrow.get("article_id")
        if isinstance(aid, str):
            aid = aid.strip() or None
        else:
            aid = None
        row = {
            "article_idx": ev.get("article_idx"),
            "article_id": aid,
            "ticker": ev["ticker"],
            "t0": ev["t0"],
            "published_at": ev.get("published_at"),
            "features": {k: v for k, v in feat.items() if k != "entry_px"},
            "entry_px": feat.get("entry_px"),
            **sc,
        }
        rows.append(row)
        if args.limit and len(rows) >= args.limit:
            break

    rows.sort(key=lambda x: (-x["score_total"], x["t0"], x["ticker"]))

    summary = {
        "generated_at": datetime.now().isoformat(),
        "methodology_note": (
            "점수는 algo_no_lookahead 백테스트와 같은 피처 축을 사용. "
            "당일 전체 고저(range) 미사용. "
            "앵커(F) 대비 전일 종가·저가 항목은 F 봉 종료 후에만 확정 가능한 값이므로 "
            "실전에서는 '앵커 체결 조건부'로 해석할 것."
        ),
        "count_scored": len(rows),
        "count_skipped_no_features": n_skip,
        "weights": {
            "time_max15": "공개시각 KST: <8시 만점 꺽임",
            "ma20_max20": "close_vs_ma20 높을수록(0.05→) 낮은 점수, -0.10 근처 만점",
            "ret1d_max15": "전일 수익률 하락 클수록 높음",
            "gap_max15": "갭 하락 클수록 높음 (앵커 세션 시가 vs 직전일 종가)",
            "anchor_max25": "F 대비 전일 종가·저가 이격 (깊게 음수일수록 높음)",
            "bonus_max10": "S2·S4·S5 유사 조합 가산",
        },
        "top": rows[:30],
        "all": rows if len(rows) <= 5000 else None,
    }

    if not args.no_json:
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        out_full = {
            "generated_at": summary["generated_at"],
            "methodology_note": summary["methodology_note"],
            "count_scored": summary["count_scored"],
            "count_skipped_no_features": summary["count_skipped_no_features"],
            "weights": summary["weights"],
            "rows": rows,
        }
        with open(OUT_JSON, "w", encoding="utf-8") as fp:
            json.dump(out_full, fp, ensure_ascii=False, indent=2, default=str)
        print(f"Saved {len(rows)} rows → {OUT_JSON}")

    print(f"scored={len(rows)} skipped={n_skip}")
    for r in rows[:15]:
        print(f"  {r['score_total']:>6.1f}  {r['ticker']}  {r['t0']}  {r['flags']}")


if __name__ == "__main__":
    run()
