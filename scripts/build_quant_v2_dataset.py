#!/usr/bin/env python3
"""
Quant V2 — 통합 피처 데이터셋 빌드

기술 지표(D-1 EOD) + 이벤트 피처(발행시각, 갭, MA20이격) + 감성 피처를 결합하여
1일 수익률 방향 예측 모델 학습용 CSV를 생성한다.

모든 피처는 lookahead 없음 (발행 시점 이전 정보만 사용).
타겟: T+1 종가 기준 1일 수익률.

출력:
  data/analysis/quant_v2_features.csv
  data/analysis/quant_v2_features.json  (메타 정보)

사용:
  python3 scripts/build_quant_v2_dataset.py
"""
from __future__ import annotations

import csv
import json
import math
import sys
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from functools import lru_cache
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from entry_hold_analysis import (
    _cached_eod_bars,
    _cached_intra_bars,
    eod_index_on_or_after,
    eod_index_for_session_ymd,
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
from analyze_10m_return_path import (
    parse_publish_utc_naive,
    is_market_bar,
    group_by_date,
    first_session_kst_date,
)

EODHD_WINDOWS = ROOT / "data" / "eodhd_news_windows"
KST = ZoneInfo("Asia/Seoul")
OUT_CSV = ROOT / "data" / "analysis" / "quant_v2_features.csv"
OUT_JSON = ROOT / "data" / "analysis" / "quant_v2_features_meta.json"
CLASSIFIED_PATH = ROOT / "data" / "somedaynews_article_tickers_classified.json"


def _load_sentiment_map() -> dict[str, dict]:
    """article_id → sentiment fields."""
    if not CLASSIFIED_PATH.is_file():
        return {}
    rows = json.loads(CLASSIFIED_PATH.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for r in rows:
        aid = r.get("article_id")
        if not isinstance(aid, str):
            continue
        out[aid] = {
            "sentiment": r.get("sentiment"),
            "sentiment_confidence": r.get("sentiment_confidence"),
            "stock_catalyst": r.get("stock_catalyst"),
            "article_primary_type_ko": r.get("article_primary_type_ko"),
        }
    return out


# ── 기술 지표 (D-1 EOD bars, redesign_quant_score.py 동일 로직) ──────

def _sma(closes: list[float], n: int) -> float | None:
    if len(closes) < n:
        return None
    return sum(closes[-n:]) / n


def _atr14(bars: list[dict]) -> float | None:
    if len(bars) < 15:
        return None
    trs: list[float] = []
    for i in range(1, len(bars)):
        pc = float(bars[i - 1]["close"])
        h = float(bars[i]["high"])
        lo = float(bars[i]["low"])
        trs.append(max(h - lo, abs(h - pc), abs(lo - pc)))
    atr = sum(trs[:14]) / 14
    for tr in trs[14:]:
        atr = (atr * 13 + tr) / 14
    return atr


def _bb_pct_b(closes: list[float], n: int = 20, mult: int = 2) -> float | None:
    if len(closes) < n:
        return None
    sl = closes[-n:]
    mid = sum(sl) / n
    std = math.sqrt(sum((x - mid) ** 2 for x in sl) / n)
    if std == 0:
        return 0.5
    up = mid + mult * std
    lo = mid - mult * std
    if up == lo:
        return 0.5
    return (closes[-1] - lo) / (up - lo)


def _bb_width(closes: list[float], n: int = 20, mult: int = 2) -> float | None:
    if len(closes) < n:
        return None
    sl = closes[-n:]
    mid = sum(sl) / n
    if mid == 0:
        return None
    std = math.sqrt(sum((x - mid) ** 2 for x in sl) / n)
    return (2 * mult * std) / mid * 100


def _rsi14(closes: list[float]) -> float | None:
    if len(closes) < 15:
        return None
    ch = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    ag = sum(c for c in ch[:14] if c > 0) / 14
    al = sum(-c for c in ch[:14] if c < 0) / 14
    for c in ch[14:]:
        ag = (ag * 13 + (c if c > 0 else 0)) / 14
        al = (al * 13 + (-c if c < 0 else 0)) / 14
    if al == 0:
        return 100.0
    return 100 - 100 / (1 + ag / al)


def _mom10(closes: list[float]) -> float | None:
    if len(closes) <= 10:
        return None
    past = closes[-11]
    cur = closes[-1]
    if past == 0:
        return None
    return (cur / past - 1) * 100


def compute_technical_indicators(bars: list[dict]) -> dict[str, float | None]:
    closes = [float(b["close"]) for b in bars]
    volumes = [float(b.get("volume") or 0) for b in bars]

    ma5 = _sma(closes, 5)
    ma20 = _sma(closes, 20)
    spread = (ma5 - ma20) / ma20 * 100 if ma5 and ma20 and ma20 != 0 else None

    _atr = _atr14(bars)
    atr_ratio = (_atr / ma20 * 100) if _atr and ma20 and ma20 != 0 else None

    bb_b = _bb_pct_b(closes)
    bb_w = _bb_width(closes)
    rsi = _rsi14(closes)
    mom = _mom10(closes)

    vol_ratio = None
    vol_spike = None
    if len(volumes) >= 21:
        avg20 = sum(volumes[-21:-1]) / 20
        if avg20 > 0:
            vol_ratio = volumes[-1] / avg20
    if len(volumes) >= 6:
        avg5 = sum(volumes[-6:-1]) / 5
        if avg5 > 0:
            vol_spike = volumes[-1] / avg5

    return {
        "ma5_20_spread": spread,
        "atr_ratio": atr_ratio,
        "bb_pct_b": bb_b,
        "bb_width": bb_w,
        "rsi14": rsi,
        "momentum10d": mom,
        "vol_ratio20": vol_ratio,
        "vol_spike_ratio": vol_spike,
    }


def compute_event_features(
    ev: dict, eod: list[dict], i0: int, all_intra: list[dict]
) -> dict[str, float | None] | None:
    """이벤트 피처 추출 (article_news_score.py 로직 기반)."""
    pa = ev.get("published_at")
    if not isinstance(pa, str) or not pa.strip():
        return None
    try:
        pu = parse_publish_utc_naive(pa.strip())
    except (ValueError, TypeError):
        return None

    t0_d = date.fromisoformat(ev["t0"])
    finfo = first_close_after_publish_bar_info(all_intra, t0_d, pu)
    if finfo is None:
        return None
    px_f, dk_f, _ = finfo
    idx_f = eod_index_for_session_ymd(eod, dk_f)
    if idx_f is None or px_f <= 0:
        return None

    def cl(i: int) -> float | None:
        if 0 <= i < len(eod):
            v = eod[i].get("close")
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

    out: dict[str, float | None] = {
        "pub_hour": float(kst_dt.hour),
        "pub_weekday": float(kst_dt.weekday()),
        "entry_vs_prev_close": px_f / c_m1 - 1.0,
    }

    if l_m1 and l_m1 > 0:
        out["entry_vs_prev_low"] = px_f / l_m1 - 1.0
    else:
        out["entry_vs_prev_low"] = None

    if c_m2 and c_m2 > 0:
        out["ret_1d_pre"] = c_m1 / c_m2 - 1.0
    else:
        out["ret_1d_pre"] = None

    if i0 >= 20:
        s20 = [cl(i0 - 20 + k) for k in range(20)]
        if all(x and x > 0 for x in s20):
            out["close_vs_ma20"] = c_m1 / (sum(s20) / 20.0) - 1.0
        else:
            out["close_vs_ma20"] = None
    else:
        out["close_vs_ma20"] = None

    if idx_f > 0:
        prev_close = cl(idx_f - 1)
    else:
        prev_close = None
    day_open = first_intraday_session_open(all_intra, dk_f)
    if prev_close and prev_close > 0 and day_open and day_open > 0:
        out["gap_open_pct"] = day_open / prev_close - 1.0
    else:
        out["gap_open_pct"] = None

    return out


def compute_target(eod: list[dict], i0: int, all_intra: list[dict]) -> dict[str, float | None]:
    """
    다중 거래일 수익률 타겟 (D-1 종가 기준).

    앵커: D-1 종가 (뉴스 발행 전날 종가) — 뉴스 영향 측정에 가장 깨끗한 기준.
    T+1, T+3, T+5, T+8 종가 수익률을 모두 저장해 복합 라벨 학습에 사용.
    """
    if i0 is None or i0 + 1 >= len(eod):
        return {"ret_1d": None, "ret_3d": None, "ret_5d": None, "ret_8d": None,
                "ret_1d_intra": None}

    anchor = float(eod[i0 - 1]["close"]) if i0 > 0 else None
    if not anchor or anchor <= 0:
        return {"ret_1d": None, "ret_3d": None, "ret_5d": None, "ret_8d": None,
                "ret_1d_intra": None}

    def fwd_ret(n: int) -> float | None:
        idx = i0 + n
        if idx >= len(eod):
            return None
        c = eod[idx].get("close")
        v = float(c) if c is not None else None
        if not v or v <= 0:
            return None
        return (v / anchor - 1.0) * 100

    ret_1d = fwd_ret(1)
    ret_3d = fwd_ret(3)
    ret_5d = fwd_ret(5)
    ret_8d = fwd_ret(8)

    t1d = eod[i0 + 1]["date"] if i0 + 1 < len(eod) else None
    intra_cl_t1 = last_intraday_session_close(all_intra, t1d) if t1d else None
    ret_1d_intra = None
    if intra_cl_t1 and anchor > 0:
        ret_1d_intra = (intra_cl_t1 / anchor - 1.0) * 100

    return {
        "ret_1d": ret_1d,
        "ret_1d_intra": ret_1d_intra,
        "ret_3d": ret_3d,
        "ret_5d": ret_5d,
        "ret_8d": ret_8d,
    }


FEATURE_COLS = [
    "ma5_20_spread", "atr_ratio", "bb_pct_b", "bb_width",
    "rsi14", "momentum10d", "vol_ratio20", "vol_spike_ratio",
    "pub_hour", "pub_weekday", "entry_vs_prev_close", "entry_vs_prev_low",
    "ret_1d_pre", "close_vs_ma20", "gap_open_pct",
    "sentiment_positive", "sentiment_negative",
    "sentiment_confidence", "catalyst_bullish", "catalyst_bearish",
]

TARGET_COLS = ["ret_1d", "ret_1d_intra", "ret_3d", "ret_5d", "ret_8d"]

META_COLS = ["article_id", "article_idx", "ticker", "t0", "published_at"]


def main() -> None:
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음")
        return

    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        print("기사 파일 없음:", articles_path)
        return
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    sentiment_map = _load_sentiment_map()
    print(f"감성 데이터: {len(sentiment_map)}건 로드")

    rows: list[dict] = []
    skip_reasons: dict[str, int] = {}

    def skip(reason: str) -> None:
        skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True,
    ):
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        t0_str = ev["t0"]
        rel = m.get("intraday_path")
        eod_rel = m.get("eod_path")

        if not ticker or not t0_str or not rel or not eod_rel:
            skip("no_paths"); continue
        if not valid_ticker(ticker) or is_excluded(ticker):
            skip("excluded"); continue

        eod = _cached_eod_bars(eod_rel)
        all_intra = _cached_intra_bars(rel)
        t0_d = date.fromisoformat(t0_str)
        i0 = eod_index_on_or_after(eod, t0_d)
        if i0 is None or i0 < 15:
            skip("no_t0_or_short_history"); continue

        pre_bars = eod[:i0]
        if len(pre_bars) < 20:
            skip("short_pre_bars"); continue

        tech = compute_technical_indicators(pre_bars)
        if any(tech[k] is None for k in ["ma5_20_spread", "atr_ratio", "bb_pct_b", "rsi14", "momentum10d"]):
            skip("missing_tech_indicators"); continue

        event_feat = compute_event_features(ev, eod, i0, all_intra)
        if event_feat is None:
            skip("missing_event_features"); continue

        target = compute_target(eod, i0, all_intra)
        # 복합 라벨 학습에 8거래일까지 모두 필요 — 하나라도 없으면 skip
        if target["ret_1d"] is None or target["ret_8d"] is None:
            skip("missing_target"); continue

        aid = m.get("article_id")
        if isinstance(aid, str):
            aid = aid.strip() or None

        sent = sentiment_map.get(aid, {}) if aid else {}
        sent_label = sent.get("sentiment", "")
        sent_conf = sent.get("sentiment_confidence")
        catalyst = sent.get("stock_catalyst", "")

        row = {
            "article_id": aid,
            "article_idx": ev.get("article_idx"),
            "ticker": ticker,
            "t0": t0_str,
            "published_at": ev.get("published_at"),
        }
        row.update(tech)
        row.update(event_feat)
        row.update({
            "sentiment_positive": 1.0 if sent_label == "positive" else 0.0,
            "sentiment_negative": 1.0 if sent_label == "negative" else 0.0,
            "sentiment_confidence": float(sent_conf) if sent_conf is not None else 0.5,
            "catalyst_bullish": 1.0 if catalyst == "bullish" else 0.0,
            "catalyst_bearish": 1.0 if catalyst == "bearish" else 0.0,
        })
        row.update(target)
        rows.append(row)

    print(f"\n유효 레코드: {len(rows)}건")
    for reason, cnt in sorted(skip_reasons.items(), key=lambda x: -x[1]):
        print(f"  skip {reason}: {cnt}")

    rows.sort(key=lambda r: (r["t0"], r["ticker"]))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    all_cols = META_COLS + FEATURE_COLS + TARGET_COLS
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=all_cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"\nCSV 저장: {OUT_CSV} ({len(rows)} rows × {len(all_cols)} cols)")

    pos = sum(1 for r in rows if r["ret_1d"] and r["ret_1d"] > 0)
    neg = len(rows) - pos
    meta = {
        "generated_at": datetime.now().isoformat(),
        "n_rows": len(rows),
        "n_positive_1d": pos,
        "n_negative_1d": neg,
        "base_rate_1d": round(pos / len(rows) * 100, 1) if rows else 0,
        "feature_cols": FEATURE_COLS,
        "target_cols": TARGET_COLS,
        "skip_reasons": skip_reasons,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"메타 저장: {OUT_JSON}")
    print(f"양전 비율(1d): {pos}/{len(rows)} = {meta['base_rate_1d']}%")


if __name__ == "__main__":
    main()
