import type { DailyOhlc } from "@/lib/stock-chart-api";

/** 최근 종가 기준 참고 매수·익절 구간 */
export type RoboPriceBands = {
  buyLow: number;
  buyHigh: number;
  tp1Low: number;
  tp1High: number;
  tp2Low: number;
  tp2High: number;
};

export type KiwoomBandMeta = {
  mode: "atr" | "pct_fallback";
  atr: number | null;
  atrPeriod: number;
  zScore: number | null;
  /** 최근 봉 구간 최고가 × 0.7 (TP1 대안 레벨 참고) */
  prevHigh70: number | null;
  /** 매수 상단·익절 하단·비용 반영 후, 일 변동성 대비 상한으로 조정한 표시 수익률(%) */
  expectedReturnTp1Pct: number;
  expectedReturnTp2Pct: number;
};

const ATR_PERIOD = 14;
const Z_LOOKBACK = 20;
const HIGH_LOOKBACK = 60;
const ENTRY_SLIPPAGE_PCT = 0.45;
const EXIT_SLIPPAGE_PCT = 0.45;
const ROUND_TRIP_COST_PCT = 0.55;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sortOhlc(ohlc: DailyOhlc[]): DailyOhlc[] {
  return [...ohlc].sort((a, b) => a.date.localeCompare(b.date));
}

function trueRange(sorted: DailyOhlc[], i: number): number {
  const h = sorted[i].high;
  const l = sorted[i].low;
  if (i === 0) return h - l;
  const pc = sorted[i - 1].close;
  return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
}

/** Wilder ATR, 마지막 봉 기준 */
export function atrWilder(sorted: DailyOhlc[], period: number): number | null {
  if (sorted.length < period + 1) return null;
  const tr: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    tr.push(trueRange(sorted, i));
  }
  if (tr.length < period) return null;
  let atr = 0;
  for (let i = 0; i < period; i++) atr += tr[i];
  atr /= period;
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }
  return atr;
}

function zScoreLastClose(sorted: DailyOhlc[], lookback: number): number | null {
  if (sorted.length < lookback) return null;
  const closes = sorted.slice(-lookback).map((r) => r.close);
  const mean = closes.reduce((a, b) => a + b, 0) / lookback;
  const variance = closes.reduce((s, c) => s + (c - mean) ** 2, 0) / lookback;
  const std = Math.sqrt(variance);
  if (std < 1e-12) return null;
  const last = closes[closes.length - 1];
  return (last - mean) / std;
}

function prevHighTimes07(sorted: DailyOhlc[], lookback: number): number | null {
  if (sorted.length === 0) return null;
  const slice = sorted.slice(-Math.min(lookback, sorted.length));
  const mx = Math.max(...slice.map((r) => r.high));
  return Math.round(mx * 0.7);
}

/**
 * 보수적 표시 수익률:
 * - 진입: 매수 구간 상단 + 슬리피지, 익절: 목표 구간 하단 − 슬리피지, 왕복 비용 차감
 * - 밴드가 ATR로 넓게 벌어지면 원시 %가 비현실적으로 커지므로, (ATR/종가)로 잡은 단기 스윙 상한으로 캡
 */
export function expectedReturnsPct(
  bands: RoboPriceBands,
  referenceClose: number,
  atr: number | null
): { tp1: number; tp2: number } {
  const entry = bands.buyHigh * (1 + ENTRY_SLIPPAGE_PCT / 100);
  const tp1 = bands.tp1Low * (1 - EXIT_SLIPPAGE_PCT / 100);
  const tp2 = bands.tp2Low * (1 - EXIT_SLIPPAGE_PCT / 100);
  if (entry <= 0 || referenceClose <= 0) return { tp1: 0, tp2: 0 };

  const rawTp1 = ((tp1 - entry) / entry) * 100 - ROUND_TRIP_COST_PCT;
  const rawTp2 = ((tp2 - entry) / entry) * 100 - ROUND_TRIP_COST_PCT;

  const atrPct =
    atr != null && atr > 0 ? (atr / referenceClose) * 100 : estimateAtrPctFallback(bands, referenceClose);

  // 단기 1차·2차 목표로 쓰기엔 이론 간격이 클 때: 일 변동성의 배수로 상한 (현실적인 스윙 폭)
  const capTp1 = clamp(0.75 * atrPct, 0.5, 2.4);
  const capTp2 = clamp(1.45 * atrPct, 1.0, 5.2);

  return {
    tp1: Math.min(rawTp1, capTp1),
    tp2: Math.min(rawTp2, capTp2),
  };
}

/** ATR 없을 때: 매수 밴드 폭으로 대략적인 일중 변동률 추정 */
function estimateAtrPctFallback(bands: RoboPriceBands, referenceClose: number): number {
  const w = (bands.buyHigh - bands.buyLow) / referenceClose;
  return clamp(w * 120, 1.2, 4.5);
}

/**
 * 표시 수익률(er)에 맞춰 TP 밴드 가격을 맞춤 → 차트 그라데이션·표 금액 일치
 * expectedReturnsPct와 동일한 entry/exit 슬리피지·비용 가정으로 역산
 */
function tpBandsFromDisplayedReturns(
  buyHigh: number,
  er: { tp1: number; tp2: number },
  referenceClose: number,
  atrForSpread: number
): Pick<RoboPriceBands, "tp1Low" | "tp1High" | "tp2Low" | "tp2High"> {
  const entry = buyHigh * (1 + ENTRY_SLIPPAGE_PCT / 100);
  const exitMult = 1 - EXIT_SLIPPAGE_PCT / 100;
  const spread1 = Math.max(2, Math.round(0.12 * atrForSpread));
  const spread2 = Math.max(2, Math.round(0.15 * atrForSpread));

  let tp1Low = Math.round(
    (entry * (1 + (er.tp1 + ROUND_TRIP_COST_PCT) / 100)) / exitMult
  );
  let tp1High = tp1Low + spread1;
  let tp2Low = Math.round(
    (entry * (1 + (er.tp2 + ROUND_TRIP_COST_PCT) / 100)) / exitMult
  );
  let tp2High = tp2Low + spread2;

  const gap = Math.max(1, Math.round(0.00025 * referenceClose));
  if (tp2Low <= tp1High) {
    tp2Low = tp1High + gap;
    tp2High = tp2Low + spread2;
  }

  return { tp1Low, tp1High, tp2Low, tp2High };
}

/** 일봉 부족 시 폴백: 종가 대비 비율 */
export function bandsFromLastClose(close: number): RoboPriceBands {
  const buyLow = Math.round(close * 0.97);
  const buyHigh = Math.round(close * 0.99);
  return {
    buyLow,
    buyHigh,
    tp1Low: Math.round(close * 1.02),
    tp1High: Math.round(close * 1.045),
    tp2Low: Math.round(close * 1.06),
    tp2High: Math.round(close * 1.1),
  };
}

/**
 * 매수: Price − 0.5×ATR ~ Price + 0.1×ATR
 * TP1: 진입가 + 1.5×ATR (좁은 밴드)
 * TP2: 진입가 + 3.0×ATR (좁은 밴드)
 * ATR 산출 불가 시 bandsFromLastClose
 */
export type KiwoomBandPack = {
  bands: RoboPriceBands;
  meta: KiwoomBandMeta;
  /** 일봉 정렬 후 최근 종가 (밴드 기준가) */
  referenceClose: number;
};

export function computeKiwoomBands(ohlc: DailyOhlc[]): KiwoomBandPack {
  const sorted = sortOhlc(ohlc);
  const lastClose = sorted[sorted.length - 1].close;
  const atr = atrWilder(sorted, ATR_PERIOD);

  if (atr == null) {
    const raw = bandsFromLastClose(lastClose);
    const er = expectedReturnsPct(raw, lastClose, null);
    const atrForSpread = Math.max(1, Math.round((raw.buyHigh - raw.buyLow) * 0.45));
    const tp = tpBandsFromDisplayedReturns(raw.buyHigh, er, lastClose, atrForSpread);
    const bands: RoboPriceBands = {
      buyLow: raw.buyLow,
      buyHigh: raw.buyHigh,
      ...tp,
    };
    const erFinal = expectedReturnsPct(bands, lastClose, null);
    return {
      bands,
      meta: {
        mode: "pct_fallback",
        atr: null,
        atrPeriod: ATR_PERIOD,
        zScore: zScoreLastClose(sorted, Z_LOOKBACK),
        prevHigh70: prevHighTimes07(sorted, HIGH_LOOKBACK),
        expectedReturnTp1Pct: erFinal.tp1,
        expectedReturnTp2Pct: erFinal.tp2,
      },
      referenceClose: lastClose,
    };
  }

  const buyLow = Math.round(lastClose - 0.5 * atr);
  const buyHigh = Math.round(lastClose + 0.1 * atr);
  const tp1Mid = lastClose + 1.5 * atr;
  const tp1LowRaw = Math.round(tp1Mid - 0.1 * atr);
  const tp1HighRaw = Math.round(tp1Mid + 0.1 * atr);
  const tp2Mid = lastClose + 3.0 * atr;
  const tp2LowRaw = Math.round(tp2Mid - 0.15 * atr);
  const tp2HighRaw = Math.round(tp2Mid + 0.15 * atr);

  const rawBands: RoboPriceBands = {
    buyLow,
    buyHigh,
    tp1Low: tp1LowRaw,
    tp1High: tp1HighRaw,
    tp2Low: tp2LowRaw,
    tp2High: tp2HighRaw,
  };
  const er = expectedReturnsPct(rawBands, lastClose, atr);
  const tp = tpBandsFromDisplayedReturns(buyHigh, er, lastClose, atr);
  const bands: RoboPriceBands = {
    buyLow,
    buyHigh,
    ...tp,
  };
  const erFinal = expectedReturnsPct(bands, lastClose, atr);

  return {
    bands,
    meta: {
      mode: "atr",
      atr,
      atrPeriod: ATR_PERIOD,
      zScore: zScoreLastClose(sorted, Z_LOOKBACK),
      prevHigh70: prevHighTimes07(sorted, HIGH_LOOKBACK),
      expectedReturnTp1Pct: erFinal.tp1,
      expectedReturnTp2Pct: erFinal.tp2,
    },
    referenceClose: lastClose,
  };
}
