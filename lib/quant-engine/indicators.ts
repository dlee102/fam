/**
 * 순수 기술적 지표 계산 모듈
 * 모든 함수는 side-effect 없는 순수 함수.
 */

import type { OhlcBar, Indicators } from "./types";

// ── 이동평균 ────────────────────────────────────────────────────────────
export function calcSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

// ── ATR ─────────────────────────────────────────────────────────────────
function trueRange(bar: OhlcBar, prevClose: number): number {
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - prevClose),
    Math.abs(bar.low - prevClose)
  );
}

export function calcATR(bars: OhlcBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i], bars[i - 1].close));
  }
  // Wilder's smoothed ATR
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// ── 볼린저 밴드 ─────────────────────────────────────────────────────────
export function calcBollingerBands(
  closes: number[],
  period = 20,
  mult = 2
): {
  upper: number | null;
  mid: number | null;
  lower: number | null;
  width: number | null;
  pct_b: number | null;
} {
  const nullResult = { upper: null, mid: null, lower: null, width: null, pct_b: null };
  if (closes.length < period) return nullResult;
  const slice = closes.slice(-period);
  const mid = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = mid + mult * std;
  const lower = mid - mult * std;
  const width = std > 0 ? ((upper - lower) / mid) * 100 : 0;
  const close = closes[closes.length - 1];
  const pct_b = upper !== lower ? (close - lower) / (upper - lower) : 0.5;
  return { upper, mid, lower, width, pct_b };
}

// ── RSI ─────────────────────────────────────────────────────────────────
export function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  // 초기 평균 이익/손실
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  // Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ── 거래량 비율 ─────────────────────────────────────────────────────────
export function calcVolumeRatio(volumes: number[], period = 20): number | null {
  if (volumes.length < period + 1) return null;
  const hist = volumes.slice(-period - 1, -1);
  const avgVol = hist.reduce((s, v) => s + v, 0) / period;
  if (avgVol === 0) return null;
  return volumes[volumes.length - 1] / avgVol;
}

// ── 모멘텀 ──────────────────────────────────────────────────────────────
export function calcMomentum(closes: number[], period = 10): number | null {
  if (closes.length <= period) return null;
  const past = closes[closes.length - 1 - period];
  const cur = closes[closes.length - 1];
  if (past === 0) return null;
  return ((cur / past) - 1) * 100;
}

// ── 종합 지표 계산 ─────────────────────────────────────────────────────
export function computeIndicators(bars: OhlcBar[]): Indicators {
  if (bars.length === 0) {
    return {
      ma5: null, ma20: null, ma5_20_spread: null,
      atr14: null, atr_ratio: null,
      bb_upper: null, bb_mid: null, bb_lower: null, bb_width: null, bb_pct_b: null,
      rsi14: null, vol_ratio20: null, momentum10d: null,
    };
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const ma5 = calcSMA(closes, 5);
  const ma20 = calcSMA(closes, 20);
  const ma5_20_spread =
    ma5 !== null && ma20 !== null && ma20 !== 0
      ? ((ma5 - ma20) / ma20) * 100
      : null;

  const atr14 = calcATR(bars, 14);
  const atr_ratio =
    atr14 !== null && ma20 !== null && ma20 !== 0
      ? (atr14 / ma20) * 100
      : null;

  const bb = calcBollingerBands(closes, 20, 2);
  const rsi14 = calcRSI(closes, 14);
  const vol_ratio20 = calcVolumeRatio(volumes, 20);
  const momentum10d = calcMomentum(closes, 10);

  return {
    ma5,
    ma20,
    ma5_20_spread,
    atr14,
    atr_ratio,
    bb_upper: bb.upper,
    bb_mid: bb.mid,
    bb_lower: bb.lower,
    bb_width: bb.width,
    bb_pct_b: bb.pct_b,
    rsi14,
    vol_ratio20,
    momentum10d,
  };
}
