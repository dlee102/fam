/**
 * 시그널 탐지 모듈 — 바이오 소형주 특화 v2
 *
 * 보고서 근거 (섹션 7 — 앙상블 분석, 총 1,611건):
 * ┌──────────────────────────┬──────┬───────────┬────────┬──────┐
 * │ 시그널                   │  n   │ 평균수익% │  승률  │  PF  │
 * ├──────────────────────────┼──────┼───────────┼────────┼──────┤
 * │ Aggressive Contrarian    │   66 │  +1.55%   │ 47.0%  │ 1.27 │
 * │ Volatility Squeeze       │  841 │  +1.03%   │ 42.0%  │ 1.56 │
 * │ Oversold Rebound         │  406 │  +1.01%   │ 45.8%  │ 1.23 │
 * │ Momentum (Warning)       │  683 │  -0.35%   │ 38.2%  │ 1.26 │
 * │ Dilution Risk (v2 신규)  │  --  │    --     │   --   │  --  │
 * └──────────────────────────┴──────┴───────────┴────────┴──────┘
 *
 * 바이오 소형주 보정:
 *  - Squeeze BB폭 임계를 15/20 → 25/30으로 확대 (바이오 밴드가 원래 넓음)
 *  - Momentum Warning 이격 임계를 4% → 8%로 확대 (바이오 정상 이격 넓음)
 *  - Contrarian RSI 임계를 35/45 → 40/50으로 완화 (바이오 RSI 편차 큼)
 *  - Dilution Risk 신규: 거래량↑ + 가격↓ 동시 발생 = 유상증자·CB 행사 패턴
 */

import type { Indicators, SignalResult, SignalType } from "./types";

function sig(
  type: SignalType,
  label: string,
  strength: number,
  confidence: SignalResult["confidence"],
  expected_return_pct: number | null,
  expected_pf: number | null,
  factors: string[]
): SignalResult {
  return { type, label, strength, confidence, expected_return_pct, expected_pf, factors };
}

// ── Aggressive Contrarian ───────────────────────────────────────────────
// 바이오 보정: RSI 40/50 (기존 35/45), 바이오는 RSI 분포가 넓어 기준 완화
function detectContrarian(ind: Indicators): SignalResult | null {
  const { rsi14, vol_ratio20, bb_pct_b, momentum10d } = ind;
  if (rsi14 === null) return null;

  const factors: string[] = [];
  let score = 0;

  if (rsi14 < 30) {
    factors.push(`RSI ${rsi14.toFixed(1)} (극도 과매도 < 30)`);
    score += 55;
  } else if (rsi14 < 40) {
    factors.push(`RSI ${rsi14.toFixed(1)} (강한 과매도 < 40)`);
    score += 40;
  } else if (rsi14 < 50) {
    factors.push(`RSI ${rsi14.toFixed(1)} (과매도 구간)`);
    score += 20;
  } else {
    return null;
  }

  if (vol_ratio20 !== null && vol_ratio20 > 1.5) {
    factors.push(`거래량 비율 ${vol_ratio20.toFixed(2)}× (거래 실림)`);
    score += 30;
  } else if (vol_ratio20 !== null && vol_ratio20 > 0.8) {
    score += 10;
  }

  if (bb_pct_b !== null && bb_pct_b < 0.25) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 하단)`);
    score += 20;
  }

  if (momentum10d !== null && momentum10d < -8) {
    factors.push(`10일 모멘텀 ${momentum10d.toFixed(1)}% (바이오 급락 후)`);
    score += 15;
  } else if (momentum10d !== null && momentum10d < -3) {
    factors.push(`10일 모멘텀 ${momentum10d.toFixed(1)}% (사전 하락)`);
    score += 8;
  }

  score = Math.min(100, score);
  if (score < 45) return null;

  const conf = rsi14 < 35 && vol_ratio20 !== null && vol_ratio20 > 1.5 ? "HIGH" : "MED";
  return sig("AGGRESSIVE_CONTRARIAN", "많이 빠진 뒤 반등을 노릴 만한 구간(바이오 눌림)", score, conf, 1.55, 1.27, factors);
}

// ── Volatility Squeeze ──────────────────────────────────────────────────
// 바이오 보정: BB폭 임계를 15/20/25 → 20/30/38로 확대
// 바이오 소형주는 평상시 BB폭이 20-30%대로 대형주(10-15%)보다 넓음
function detectSqueeze(ind: Indicators): SignalResult | null {
  const { bb_width, atr_ratio, ma5_20_spread } = ind;
  if (bb_width === null) return null;

  const factors: string[] = [];
  let score = 0;

  if (bb_width < 20) {
    factors.push(`BB폭 ${bb_width.toFixed(1)}% (바이오 기준 강한 응축 < 20%)`);
    score += 55;
  } else if (bb_width < 30) {
    factors.push(`BB폭 ${bb_width.toFixed(1)}% (바이오 기준 응축 < 30%)`);
    score += 38;
  } else if (bb_width < 38) {
    factors.push(`BB폭 ${bb_width.toFixed(1)}% (수렴 중)`);
    score += 18;
  } else {
    return null;
  }

  if (atr_ratio !== null && atr_ratio < 7.0) {
    factors.push(`ATR비율 ${atr_ratio.toFixed(1)}% (바이오 기준 낮음)`);
    score += 25;
  } else if (atr_ratio !== null && atr_ratio < 9.0) {
    factors.push(`ATR비율 ${atr_ratio.toFixed(1)}% (바이오 기준 보통)`);
    score += 12;
  }

  if (ma5_20_spread !== null && Math.abs(ma5_20_spread) < 4.0) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (과열 없음)`);
    score += 18;
  }

  score = Math.min(100, score);
  if (score < 38) return null;

  const conf = bb_width < 20 && (atr_ratio ?? 99) < 7.0 ? "HIGH" : "MED";
  return sig("VOLATILITY_SQUEEZE", "변동성이 좁아진 구간 — 바이오 방향성 폭발 대기", score, conf, 1.03, 1.56, factors);
}

// ── Oversold Rebound ────────────────────────────────────────────────────
// 바이오 보정: %B 임계를 0.35 → 0.40, RSI를 50 → 55 확대
function detectOversoldRebound(ind: Indicators): SignalResult | null {
  const { bb_pct_b, rsi14, ma5_20_spread } = ind;
  if (bb_pct_b === null || rsi14 === null) return null;

  const factors: string[] = [];
  let score = 0;

  if (bb_pct_b < 0.15) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 극하단)`);
    score += 45;
  } else if (bb_pct_b < 0.30) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 하단 근접)`);
    score += 32;
  } else if (bb_pct_b < 0.40) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (하단 구간)`);
    score += 20;
  } else {
    return null;
  }

  if (rsi14 < 35) {
    factors.push(`RSI ${rsi14.toFixed(1)} (극도 과매도)`);
    score += 38;
  } else if (rsi14 < 45) {
    factors.push(`RSI ${rsi14.toFixed(1)} (과매도)`);
    score += 28;
  } else if (rsi14 < 55) {
    factors.push(`RSI ${rsi14.toFixed(1)} (중립 이하)`);
    score += 15;
  } else {
    return null;
  }

  if (ma5_20_spread !== null && ma5_20_spread < -2) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (단기 눌림)`);
    score += 15;
  }

  score = Math.min(100, score);
  if (score < 38) return null;

  const conf = bb_pct_b < 0.15 && rsi14 < 35 ? "HIGH" : "MED";
  return sig("OVERSOLD_REBOUND", "바이오 과매도 반등 — 단기 되돌림 기대 구간", score, conf, 1.01, 1.23, factors);
}

// ── Momentum Warning ────────────────────────────────────────────────────
// 바이오 보정: 이격 임계를 4%/2.61% → 8%/5%로 상향
// 바이오 소형주는 이격 5-7%가 정상 상승세에서 나타남
function detectMomentumWarning(ind: Indicators): SignalResult | null {
  const { ma5_20_spread, rsi14, momentum10d, bb_pct_b, volume_spike_ratio } = ind;
  const factors: string[] = [];
  let score = 0;

  if (ma5_20_spread !== null && ma5_20_spread > 10) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (바이오 기준 강한 과열 > 10%)`);
    score += 40;
  } else if (ma5_20_spread !== null && ma5_20_spread > 8) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (과열 구간)`);
    score += 28;
  } else if (ma5_20_spread !== null && ma5_20_spread > 5) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (주의 구간)`);
    score += 12;
  }

  if (rsi14 !== null && rsi14 > 72) {
    factors.push(`RSI ${rsi14.toFixed(1)} (강한 과매수)`);
    score += 35;
  } else if (rsi14 !== null && rsi14 > 62) {
    factors.push(`RSI ${rsi14.toFixed(1)} (과매수)`);
    score += 18;
  }

  if (momentum10d !== null && momentum10d > 12) {
    factors.push(`10일 모멘텀 +${momentum10d.toFixed(1)}% (바이오 급등)`);
    score += 25;
  } else if (momentum10d !== null && momentum10d > 8) {
    factors.push(`10일 모멘텀 +${momentum10d.toFixed(1)}% (사전 상승)`);
    score += 12;
  }

  if (bb_pct_b !== null && bb_pct_b > 0.90) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 극상단)`);
    score += 18;
  }

  if (volume_spike_ratio !== null && volume_spike_ratio > 5.0) {
    factors.push(`거래량 스파이크 ${volume_spike_ratio.toFixed(1)}× (투기 과열)`);
    score += 15;
  }

  score = Math.min(100, score);
  if (score < 35) return null;

  const conf = score >= 70 ? "HIGH" : score >= 50 ? "MED" : "LOW";
  return sig("MOMENTUM_WARNING", "바이오 단기 급등·과열(추격 매수 고위험)", score, conf, -0.35, null, factors);
}

// ── Dilution Risk (바이오 소형주 전용) ───────────────────────────────────
// 유상증자·전환사채(CB)·BW 행사 패턴: 거래량 급증 + 가격 하락 동시
// 바이오 소형주에서 자금 조달을 위한 희석 발행이 잦고 주가에 악영향이 큼
function detectDilutionRisk(ind: Indicators): SignalResult | null {
  const { vol_ratio20, volume_spike_ratio, momentum10d, gap_pct, bb_pct_b } = ind;
  const factors: string[] = [];
  let score = 0;

  const hasVolSurge =
    (vol_ratio20 !== null && vol_ratio20 > 3.0) ||
    (volume_spike_ratio !== null && volume_spike_ratio > 4.0);
  const hasPriceDrop = momentum10d !== null && momentum10d < -3;

  if (!hasVolSurge || !hasPriceDrop) return null;

  if (vol_ratio20 !== null && vol_ratio20 > 5.0) {
    factors.push(`거래량 ${vol_ratio20.toFixed(1)}× (대량 거래 — 물량 출회 의심)`);
    score += 40;
  } else if (vol_ratio20 !== null && vol_ratio20 > 3.0) {
    factors.push(`거래량 ${vol_ratio20.toFixed(1)}× (증가 — 물량 소화 중)`);
    score += 25;
  }

  if (volume_spike_ratio !== null && volume_spike_ratio > 6.0) {
    factors.push(`5일 대비 스파이크 ${volume_spike_ratio.toFixed(1)}× (급격한 물량)`);
    score += 20;
  }

  if (momentum10d !== null && momentum10d < -10) {
    factors.push(`10일 모멘텀 ${momentum10d.toFixed(1)}% (가격 급락)`);
    score += 25;
  } else if (momentum10d !== null && momentum10d < -5) {
    factors.push(`10일 모멘텀 ${momentum10d.toFixed(1)}% (가격 하락)`);
    score += 15;
  }

  if (gap_pct !== null && gap_pct < -3) {
    factors.push(`갭다운 ${gap_pct.toFixed(1)}% (장전 악재 반영)`);
    score += 15;
  }

  if (bb_pct_b !== null && bb_pct_b < 0.20) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 하단 — 매도 압력)`);
    score += 10;
  }

  score = Math.min(100, score);
  if (score < 40) return null;

  const conf = score >= 65 ? "HIGH" : "MED";
  return sig(
    "DILUTION_RISK",
    "거래량 급증 + 가격 하락 동시 — 유상증자·CB행사·물량 출회 위험",
    score,
    conf,
    null,
    null,
    factors
  );
}

// ── 전체 시그널 탐지 ────────────────────────────────────────────────────
export function detectSignals(ind: Indicators): SignalResult[] {
  const candidates: (SignalResult | null)[] = [
    detectContrarian(ind),
    detectSqueeze(ind),
    detectOversoldRebound(ind),
    detectMomentumWarning(ind),
    detectDilutionRisk(ind),
  ];

  const detected = candidates.filter((s): s is SignalResult => s !== null);
  return detected.sort((a, b) => b.strength - a.strength);
}

export const NEUTRAL_SIGNAL: SignalResult = {
  type: "NEUTRAL",
  label: "차트만으로는 뚜렷한 패턴이 거의 없음",
  strength: 30,
  confidence: "LOW",
  expected_return_pct: null,
  expected_pf: null,
  factors: ["조건 충족 시그널 없음"],
};
