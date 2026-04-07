#!/usr/bin/env python3
"""
OHLCV 기술적 지표 라이브러리 (순수 함수, pandas 미사용)

- 입력: EODHD EOD bars (list[dict], keys: date/open/high/low/close/volume)
        또는 EODHD 5분봉 bars (list[dict], keys: datetime/open/high/low/close/volume)
- 모든 함수는 bars를 시간 오름차순으로 정렬된 상태로 가정합니다.
- 계산 불가(데이터 부족 등)시 None 반환.
"""
from __future__ import annotations

import math
from typing import Sequence


# ──────────────────────────────────────────────────────────
# 내부 헬퍼
# ──────────────────────────────────────────────────────────

def _closes(bars: list[dict]) -> list[float]:
    return [float(b["close"] or b.get("open") or 0) for b in bars]

def _highs(bars: list[dict]) -> list[float]:
    return [float(b["high"] or b.get("close") or 0) for b in bars]

def _lows(bars: list[dict]) -> list[float]:
    return [float(b["low"] or b.get("close") or 0) for b in bars]

def _volumes(bars: list[dict]) -> list[float]:
    return [float(b.get("volume") or 0) for b in bars]

def _opens(bars: list[dict]) -> list[float]:
    return [float(b["open"]) for b in bars]


# ──────────────────────────────────────────────────────────
# 이동평균
# ──────────────────────────────────────────────────────────

def sma(values: list[float], period: int) -> list[float | None]:
    """단순이동평균. 앞 period-1 값은 None."""
    out: list[float | None] = [None] * len(values)
    for i in range(period - 1, len(values)):
        out[i] = sum(values[i - period + 1 : i + 1]) / period
    return out


def ema(values: list[float], period: int) -> list[float | None]:
    """지수이동평균 (초기값 = SMA). 앞 period-1 값은 None."""
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    k = 2.0 / (period + 1)
    out[period - 1] = sum(values[:period]) / period
    for i in range(period, len(values)):
        out[i] = values[i] * k + out[i - 1] * (1 - k)  # type: ignore[operator]
    return out


def ema_last(values: list[float], period: int) -> float | None:
    """마지막 EMA 값만 반환."""
    e = ema(values, period)
    return next((v for v in reversed(e) if v is not None), None)


def sma_last(values: list[float], period: int) -> float | None:
    s = sma(values, period)
    return next((v for v in reversed(s) if v is not None), None)


# ──────────────────────────────────────────────────────────
# 변동성
# ──────────────────────────────────────────────────────────

def true_ranges(bars: list[dict]) -> list[float]:
    """True Range 리스트. 첫 봉은 H-L만 사용."""
    trs = []
    closes = _closes(bars)
    highs = _highs(bars)
    lows = _lows(bars)
    for i, b in enumerate(bars):
        if i == 0:
            trs.append(highs[i] - lows[i])
        else:
            prev_c = closes[i - 1]
            trs.append(max(highs[i] - lows[i], abs(highs[i] - prev_c), abs(lows[i] - prev_c)))
    return trs


def atr(bars: list[dict], period: int = 14) -> list[float | None]:
    """Wilder ATR. 앞 period-1 값은 None."""
    trs = true_ranges(bars)
    out: list[float | None] = [None] * len(trs)
    if len(trs) < period:
        return out
    # 초기값: SMA of TR
    out[period - 1] = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        out[i] = (out[i - 1] * (period - 1) + trs[i]) / period  # type: ignore[operator]
    return out


def atr_last(bars: list[dict], period: int = 14) -> float | None:
    a = atr(bars, period)
    return next((v for v in reversed(a) if v is not None), None)


def historical_volatility(bars: list[dict], period: int = 20, annualize: int = 252) -> float | None:
    """로그수익률 표준편차 × √annualize. EOD 일봉 기준."""
    closes = _closes(bars)
    if len(closes) < period + 1:
        return None
    log_rets = [math.log(closes[i] / closes[i - 1]) for i in range(len(closes) - period, len(closes))]
    mean_r = sum(log_rets) / len(log_rets)
    var = sum((r - mean_r) ** 2 for r in log_rets) / (len(log_rets) - 1)
    return math.sqrt(var * annualize)


# ──────────────────────────────────────────────────────────
# 볼린저 밴드
# ──────────────────────────────────────────────────────────

def bollinger_bands(
    bars: list[dict], period: int = 20, k: float = 2.0
) -> list[dict[str, float | None]]:
    """
    Returns list of {upper, middle, lower, pct_b, width_pct}.
    pct_b = (close - lower) / (upper - lower), 0~1 구간이 밴드 안.
    width_pct = (upper - lower) / middle * 100.
    """
    closes = _closes(bars)
    ma = sma(closes, period)
    out = []
    for i, c in enumerate(closes):
        m = ma[i]
        if m is None or i < period - 1:
            out.append({"upper": None, "middle": None, "lower": None, "pct_b": None, "width_pct": None})
            continue
        slice_ = closes[i - period + 1 : i + 1]
        mean_ = sum(slice_) / period
        std = math.sqrt(sum((x - mean_) ** 2 for x in slice_) / period)
        upper = m + k * std
        lower = m - k * std
        band_w = upper - lower
        out.append({
            "upper": upper,
            "middle": m,
            "lower": lower,
            "pct_b": (c - lower) / band_w if band_w > 0 else None,
            "width_pct": band_w / m * 100 if m > 0 else None,
        })
    return out


def bb_last(bars: list[dict], period: int = 20, k: float = 2.0) -> dict[str, float | None]:
    return bollinger_bands(bars, period, k)[-1]


# ──────────────────────────────────────────────────────────
# RSI
# ──────────────────────────────────────────────────────────

def rsi(bars: list[dict], period: int = 14) -> list[float | None]:
    """Wilder RSI (0~100)."""
    closes = _closes(bars)
    out: list[float | None] = [None] * len(closes)
    if len(closes) < period + 1:
        return out
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    # 초기 avg gain/loss (SMA)
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    if avg_l == 0:
        out[period] = 100.0
    else:
        rs = avg_g / avg_l
        out[period] = 100 - 100 / (1 + rs)
    for i in range(period + 1, len(closes)):
        avg_g = (avg_g * (period - 1) + gains[i - 1]) / period
        avg_l = (avg_l * (period - 1) + losses[i - 1]) / period
        if avg_l == 0:
            out[i] = 100.0
        else:
            rs = avg_g / avg_l
            out[i] = 100 - 100 / (1 + rs)
    return out


def rsi_last(bars: list[dict], period: int = 14) -> float | None:
    r = rsi(bars, period)
    return next((v for v in reversed(r) if v is not None), None)


# ──────────────────────────────────────────────────────────
# MACD
# ──────────────────────────────────────────────────────────

def macd(
    bars: list[dict], fast: int = 12, slow: int = 26, signal_p: int = 9
) -> list[dict[str, float | None]]:
    """Returns list of {macd_line, signal_line, histogram}."""
    closes = _closes(bars)
    fast_e = ema(closes, fast)
    slow_e = ema(closes, slow)
    macd_line: list[float | None] = [
        (f - s) if f is not None and s is not None else None
        for f, s in zip(fast_e, slow_e)
    ]
    valid_macd = [v for v in macd_line if v is not None]
    sig_raw = ema(valid_macd, signal_p) if valid_macd else []
    # sig_raw 인덱스를 macd_line 인덱스에 맞춤
    sig_line: list[float | None] = [None] * len(macd_line)
    none_count = sum(1 for v in macd_line if v is None)
    for j, val in enumerate(sig_raw):
        sig_line[none_count + j] = val
    out = []
    for m, s in zip(macd_line, sig_line):
        h = (m - s) if m is not None and s is not None else None
        out.append({"macd_line": m, "signal_line": s, "histogram": h})
    return out


def macd_last(
    bars: list[dict], fast: int = 12, slow: int = 26, signal_p: int = 9
) -> dict[str, float | None]:
    return macd(bars, fast, slow, signal_p)[-1]


# ──────────────────────────────────────────────────────────
# ADX / DMI
# ──────────────────────────────────────────────────────────

def adx(bars: list[dict], period: int = 14) -> list[dict[str, float | None]]:
    """
    Returns list of {adx, plus_di, minus_di}.
    ADX >= 25: 추세장, < 20: 횡보장.
    """
    n = len(bars)
    out = [{"adx": None, "plus_di": None, "minus_di": None}] * n
    if n < period * 2:
        return out

    highs = _highs(bars)
    lows = _lows(bars)
    closes = _closes(bars)
    trs = true_ranges(bars)

    plus_dm_list, minus_dm_list = [], []
    for i in range(1, n):
        up = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        plus_dm_list.append(up if up > down and up > 0 else 0.0)
        minus_dm_list.append(down if down > up and down > 0 else 0.0)

    # Wilder smoothing for TR, +DM, -DM
    def _wilder_smooth(values: list[float], p: int) -> list[float]:
        if len(values) < p:
            return []
        smooth = [sum(values[:p])]
        for i in range(p, len(values)):
            smooth.append(smooth[-1] - smooth[-1] / p + values[i])
        return smooth

    tr_s = _wilder_smooth(trs[1:], period)
    p_s = _wilder_smooth(plus_dm_list, period)
    m_s = _wilder_smooth(minus_dm_list, period)

    dx_list = []
    result_rows = []
    for i in range(len(tr_s)):
        t = tr_s[i]
        if t == 0:
            result_rows.append({"adx": None, "plus_di": None, "minus_di": None})
            dx_list.append(0.0)
            continue
        pdi = 100 * p_s[i] / t
        mdi = 100 * m_s[i] / t
        denom = pdi + mdi
        dx = 100 * abs(pdi - mdi) / denom if denom > 0 else 0.0
        dx_list.append(dx)
        result_rows.append({"adx": None, "plus_di": pdi, "minus_di": mdi})

    # ADX = Wilder MA of DX (_wilder_smooth은 누적합이므로 /period 로 평균 환산)
    adx_raw = _wilder_smooth(dx_list, period) if len(dx_list) >= period else []
    for i, av in enumerate(adx_raw):
        result_rows[i + period - 1]["adx"] = av / period

    # 인덱스 오프셋 맞추기 (결과를 bars 길이에 패딩)
    pad = n - len(result_rows)
    return [{"adx": None, "plus_di": None, "minus_di": None}] * pad + result_rows


def adx_last(bars: list[dict], period: int = 14) -> dict[str, float | None]:
    return adx(bars, period)[-1]


# ──────────────────────────────────────────────────────────
# OBV (On-Balance Volume)
# ──────────────────────────────────────────────────────────

def obv(bars: list[dict]) -> list[float]:
    """OBV 시리즈."""
    closes = _closes(bars)
    vols = _volumes(bars)
    result = [0.0]
    for i in range(1, len(bars)):
        if closes[i] > closes[i - 1]:
            result.append(result[-1] + vols[i])
        elif closes[i] < closes[i - 1]:
            result.append(result[-1] - vols[i])
        else:
            result.append(result[-1])
    return result


def obv_slope(bars: list[dict], lookback: int = 5) -> float | None:
    """최근 lookback 기간 OBV 기울기 (정규화: / |OBV 시작값|)."""
    if len(bars) < lookback + 1:
        return None
    o = obv(bars)
    start = o[-(lookback + 1)]
    end = o[-1]
    if start == 0:
        return None
    return (end - start) / abs(start)


# ──────────────────────────────────────────────────────────
# CMF (Chaikin Money Flow)
# ──────────────────────────────────────────────────────────

def cmf(bars: list[dict], period: int = 20) -> float | None:
    """
    CMF = sum(MF_vol, period) / sum(vol, period)
    MF_vol = ((C-L) - (H-C)) / (H-L) × vol
    -1~+1, 양수=매집, 음수=배분.
    """
    if len(bars) < period:
        return None
    window = bars[-period:]
    num, denom = 0.0, 0.0
    for b in window:
        h, l, c, v = float(b["high"]), float(b["low"]), float(b["close"]), float(b.get("volume") or 0)
        hl = h - l
        if hl > 0:
            mf = ((c - l) - (h - c)) / hl
            num += mf * v
        denom += v
    return num / denom if denom > 0 else None


# ──────────────────────────────────────────────────────────
# ROC (Rate of Change)
# ──────────────────────────────────────────────────────────

def roc(bars: list[dict], period: int = 5) -> float | None:
    """직전 period봉 대비 현재 종가 변화율."""
    closes = _closes(bars)
    if len(closes) <= period:
        return None
    base = closes[-(period + 1)]
    return (closes[-1] - base) / base if base != 0 else None


# ──────────────────────────────────────────────────────────
# VWAP (장중 인트라데이용)
# ──────────────────────────────────────────────────────────

def vwap(bars: list[dict]) -> list[float | None]:
    """
    장중 누적 VWAP. bars 전체 기간에 걸쳐 계산.
    typical_price = (H + L + C) / 3
    """
    cum_pv, cum_v = 0.0, 0.0
    result = []
    for b in bars:
        h = float(b["high"] or b.get("close") or 0)
        l = float(b["low"] or b.get("close") or 0)
        c = float(b["close"] or b.get("open") or 0)
        v = float(b.get("volume") or 0)
        if h == 0 or l == 0 or c == 0:
            result.append(cum_pv / cum_v if cum_v > 0 else None)
            continue
        tp = (h + l + c) / 3
        cum_pv += tp * v
        cum_v += v
        result.append(cum_pv / cum_v if cum_v > 0 else None)
    return result


def vwap_at(bars: list[dict]) -> float | None:
    """마지막 봉까지의 VWAP."""
    v = vwap(bars)
    return next((x for x in reversed(v) if x is not None), None)


# ──────────────────────────────────────────────────────────
# 종합 스냅샷 (EOD)
# ──────────────────────────────────────────────────────────

def eod_snapshot(bars: list[dict]) -> dict:
    """
    이벤트 직전 EOD 봉 기준 주요 지표 스냅샷.
    bars는 이벤트일 **이전**까지만 전달할 것 (미래 정보 차단).

    Returns dict with keys:
        close, ma5, ma10, ma20, ma60,
        ema9, ema21, ema9_gap,
        ma5_above_ma20, ma20_above_ma60, ma20_slope5,
        rsi14, macd_hist, macd_above_signal,
        atr14, bb_pct_b, bb_width_pct, hv20,
        vol_ratio_1d, vol_ratio_5d, vol_ratio_20d,
        obv_slope5, cmf20,
        roc5, roc10, roc20,
        adx14, plus_di, minus_di,
        ma60_gap, close_52w_high_gap, close_52w_low_gap
    """
    if not bars:
        return {}

    closes = _closes(bars)
    vols = _volumes(bars)
    last_close = closes[-1]
    last_vol = vols[-1]

    # MA
    ma5  = sma_last(closes, 5)
    ma10 = sma_last(closes, 10)
    ma20 = sma_last(closes, 20)
    ma60 = sma_last(closes, 60)
    e9   = ema_last(closes, 9)
    e21  = ema_last(closes, 21)

    # MA 정렬 (bool)
    ma5_above_ma20  = (ma5  > ma20)  if (ma5  and ma20)  else None
    ma20_above_ma60 = (ma20 > ma60)  if (ma20 and ma60)  else None

    # MA20 기울기 (5일 전 대비)
    ma20_arr = sma(closes, 20)
    valid_ma20 = [(i, v) for i, v in enumerate(ma20_arr) if v is not None]
    ma20_slope5 = None
    if len(valid_ma20) >= 6:
        cur = valid_ma20[-1][1]
        prev5 = valid_ma20[-6][1]
        ma20_slope5 = (cur - prev5) / prev5 if prev5 else None

    # RSI
    rsi14 = rsi_last(bars, 14)

    # MACD
    md = macd_last(bars)
    macd_hist = md["histogram"]
    macd_above_signal = (md["macd_line"] > md["signal_line"]) if (md["macd_line"] is not None and md["signal_line"] is not None) else None

    # ATR, BB, HV
    atr14   = atr_last(bars, 14)
    bb      = bb_last(bars, 20)
    hv20    = historical_volatility(bars, 20)

    # Volume ratios
    avg_vol5  = (sum(vols[-6:-1]) / 5)  if len(vols) >= 6  else None
    avg_vol20 = (sum(vols[-21:-1]) / 20) if len(vols) >= 21 else None
    vol_ratio_1d  = (last_vol / avg_vol5)  if avg_vol5  and avg_vol5 > 0  else None
    vol_ratio_5d  = vol_ratio_1d
    vol_ratio_20d = (last_vol / avg_vol20) if avg_vol20 and avg_vol20 > 0 else None

    # OBV, CMF
    obv_sl5 = obv_slope(bars, 5)
    cmf20   = cmf(bars, 20)

    # ROC
    roc5  = roc(bars, 5)
    roc10 = roc(bars, 10)
    roc20 = roc(bars, 20)

    # ADX
    ad = adx_last(bars, 14)

    # 가격 위치
    ma60_gap = (last_close / ma60 - 1) if ma60 else None
    ema9_gap = (last_close / e9 - 1)   if e9   else None

    highs_252 = _highs(bars[-252:]) if len(bars) >= 252 else _highs(bars)
    lows_252  = _lows(bars[-252:])  if len(bars) >= 252 else _lows(bars)
    high_52w = max(highs_252) if highs_252 else None
    low_52w  = min(lows_252)  if lows_252  else None
    close_52w_high_gap = (last_close / high_52w - 1) if high_52w else None
    close_52w_low_gap  = (last_close / low_52w  - 1) if low_52w  else None

    return {
        "close": last_close,
        "ma5": ma5, "ma10": ma10, "ma20": ma20, "ma60": ma60,
        "ema9": e9, "ema21": e21, "ema9_gap": ema9_gap,
        "ma5_above_ma20": ma5_above_ma20,
        "ma20_above_ma60": ma20_above_ma60,
        "ma20_slope5": ma20_slope5,
        "rsi14": rsi14,
        "macd_hist": macd_hist,
        "macd_above_signal": macd_above_signal,
        "atr14": atr14,
        "bb_pct_b": bb["pct_b"],
        "bb_width_pct": bb["width_pct"],
        "hv20": hv20,
        "vol_ratio_1d": vol_ratio_1d,
        "vol_ratio_5d": vol_ratio_5d,
        "vol_ratio_20d": vol_ratio_20d,
        "obv_slope5": obv_sl5,
        "cmf20": cmf20,
        "roc5": roc5, "roc10": roc10, "roc20": roc20,
        "adx14": ad["adx"],
        "plus_di": ad["plus_di"],
        "minus_di": ad["minus_di"],
        "ma60_gap": ma60_gap,
        "close_52w_high_gap": close_52w_high_gap,
        "close_52w_low_gap": close_52w_low_gap,
    }


# ──────────────────────────────────────────────────────────
# 인트라데이 스냅샷 (앵커 이전 5분봉용)
# ──────────────────────────────────────────────────────────

def intraday_snapshot(
    session_bars_5m: list[dict],
    anchor_bar_end_utc: object,   # datetime 또는 None
    publish_utc: object,          # datetime
) -> dict:
    """
    당일 5분봉에서 앵커 직전까지의 인트라데이 지표 스냅샷.

    session_bars_5m : 이벤트 당일 장중 5분봉 (시간 오름차순)
    anchor_bar_end_utc : 앵커 봉의 종료 UTC 시각 (datetime)
    publish_utc       : 기사 공개 UTC 시각 (datetime)

    Returns dict:
        session_open, overnight_gap (별도 제공),
        vwap_at_anchor, anchor_vs_vwap,
        pre_anchor_roc3, pre_anchor_body_ratio, pre_anchor_upper_wick,
        pre_publish_range_pct (기존),
        open_to_anchor_pct (기존),
        vol_front_half_ratio,   # 전반부 거래량 비중
        anchor_vol_ratio,       # 앵커봉 vs 당일 평균
        session_atr5m,          # 당일 5분봉 ATR
        bars_before_anchor      # 앵커 이전 봉 수 (데이터 양 판단용)
    """
    from datetime import datetime

    if not session_bars_5m:
        return {}

    def _bar_end(b: dict) -> "datetime":
        from datetime import timedelta
        dt_s = b["datetime"]
        dt = datetime.strptime(dt_s, "%Y-%m-%d %H:%M:%S")
        return dt + timedelta(minutes=5)

    # 앵커 이전 봉들
    if anchor_bar_end_utc is not None:
        pre_bars = [b for b in session_bars_5m if _bar_end(b) <= anchor_bar_end_utc]
    else:
        pre_bars = session_bars_5m  # 폴백: 전체

    if not pre_bars:
        return {}

    session_open_raw = session_bars_5m[0].get("open") or session_bars_5m[0].get("close")
    if not session_open_raw:
        return {}
    session_open = float(session_open_raw)
    anchor_close_raw = pre_bars[-1].get("close") or pre_bars[-1].get("open") if pre_bars else None
    anchor_close = float(anchor_close_raw) if anchor_close_raw else None

    # VWAP up to anchor
    vwap_val = vwap_at(pre_bars)
    anchor_vs_vwap = (anchor_close / vwap_val - 1) if (anchor_close and vwap_val and vwap_val > 0) else None

    # 앵커 직전 3봉 ROC
    pre_anchor_roc3 = roc(pre_bars, 3) if len(pre_bars) > 3 else None

    # 앵커봉 바디·윗꼬리 비율
    ab = pre_bars[-1]
    h, l, c, o = float(ab["high"]), float(ab["low"]), float(ab["close"]), float(ab["open"])
    hl = h - l
    pre_anchor_body_ratio = abs(c - o) / hl if hl > 0 else None
    pre_anchor_upper_wick = (h - max(c, o)) / hl if hl > 0 else None

    # 공개 전 변동폭 (기존 로직 재현)
    hi, lo = session_open, session_open
    for b in session_bars_5m:
        be = _bar_end(b)
        if be > publish_utc:
            break
        bh = float(b["high"] or b.get("close") or 0)
        bl = float(b["low"] or b.get("close") or 0)
        if bh > 0:
            hi = max(hi, bh)
        if bl > 0:
            lo = min(lo, bl) if lo > 0 else bl
    pre_publish_range_pct = (hi - lo) / session_open * 100 if session_open > 0 else None

    # 시가→앵커
    open_to_anchor_pct = (anchor_close / session_open - 1) * 100 if (anchor_close and session_open > 0) else None

    # 거래량 분포 (전반부 비중)
    vols = _volumes(session_bars_5m)
    half = max(len(vols) // 2, 1)
    total_vol = sum(vols)
    vol_front_half_ratio = sum(vols[:half]) / total_vol if total_vol > 0 else None

    # 앵커봉 거래량 vs 당일 평균
    anchor_vol = float(ab.get("volume") or 0)
    avg_vol_session = total_vol / len(session_bars_5m) if session_bars_5m else None
    anchor_vol_ratio = anchor_vol / avg_vol_session if (avg_vol_session and avg_vol_session > 0) else None

    # 당일 5분봉 ATR
    session_atr = atr_last(pre_bars, min(5, len(pre_bars)))

    return {
        "session_open": session_open,
        "anchor_close": anchor_close,
        "vwap_at_anchor": vwap_val,
        "anchor_vs_vwap": anchor_vs_vwap,
        "pre_anchor_roc3": pre_anchor_roc3,
        "pre_anchor_body_ratio": pre_anchor_body_ratio,
        "pre_anchor_upper_wick": pre_anchor_upper_wick,
        "pre_publish_range_pct": pre_publish_range_pct,
        "open_to_anchor_pct": open_to_anchor_pct,
        "vol_front_half_ratio": vol_front_half_ratio,
        "anchor_vol_ratio": anchor_vol_ratio,
        "session_atr5m": session_atr,
        "bars_before_anchor": len(pre_bars),
    }


# ──────────────────────────────────────────────────────────
# 진입봉 분석 (앵커 다음 봉)
# ──────────────────────────────────────────────────────────

def entry_bar_features(entry_bar: dict, daily_avg_vol: float | None) -> dict:
    """
    앵커 다음 10분봉(진입 후보봉) 특징.

    Returns:
        is_bullish        : 양봉 여부
        body_ratio        : 바디 비율 (1=마루보주)
        upper_wick_ratio  : 윗꼬리 비율
        vol_vs_avg        : 진입봉 거래량 / 당일 평균 봉 거래량
        close_vs_anchor   : 종가 / anchor_close - 1 (caller가 anchor_close 제공시)
    """
    h = float(entry_bar.get("high") or entry_bar.get("close") or 0)
    l = float(entry_bar.get("low") or entry_bar.get("close") or 0)
    c = float(entry_bar.get("close") or entry_bar.get("open") or 0)
    o = float(entry_bar.get("open") or entry_bar.get("close") or 0)
    v = float(entry_bar.get("volume") or 0)
    hl = h - l

    body_ratio = abs(c - o) / hl if hl > 0 else 0.0
    upper_wick = (h - max(c, o)) / hl if hl > 0 else 0.0

    return {
        "is_bullish": c > o,
        "body_ratio": body_ratio,
        "upper_wick_ratio": upper_wick,
        "vol_vs_avg": v / daily_avg_vol if (daily_avg_vol and daily_avg_vol > 0) else None,
        "close": c,
        "open": o,
    }


# ──────────────────────────────────────────────────────────
# self-test
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import random
    random.seed(42)
    fake_bars = []
    price = 10000.0
    for i in range(200):
        o = price
        c = o * (1 + random.gauss(0, 0.015))
        h = max(o, c) * (1 + random.uniform(0, 0.005))
        l = min(o, c) * (1 - random.uniform(0, 0.005))
        fake_bars.append({
            "date": f"2024-{i//20+1:02d}-{i%20+1:02d}",
            "open": o, "high": h, "low": l, "close": c, "volume": random.randint(100000, 2000000)
        })
        price = c

    snap = eod_snapshot(fake_bars)
    print("EOD Snapshot:")
    for k, v in snap.items():
        print(f"  {k:30s}: {v}")

    print("\nSelf-test passed.")
