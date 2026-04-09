/**
 * 시그널 탐지 모듈
 *
 * 보고서 근거 (섹션 7 — 앙상블 분석, 총 1,611건):
 * ┌──────────────────────────┬──────┬───────────┬────────┬──────┐
 * │ 시그널                   │  n   │ 평균수익% │  승률  │  PF  │
 * ├──────────────────────────┼──────┼───────────┼────────┼──────┤
 * │ Aggressive Contrarian    │   66 │  +1.55%   │ 47.0%  │ 1.27 │
 * │ Volatility Squeeze       │  841 │  +1.03%   │ 42.0%  │ 1.56 │
 * │ Oversold Rebound         │  406 │  +1.01%   │ 45.8%  │ 1.23 │
 * │ Momentum (Warning)       │  683 │  -0.35%   │ 38.2%  │ 1.26 │
 * └──────────────────────────┴──────┴───────────┴────────┴──────┘
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
// 조건: RSI < 35 (강한 과매도) + 거래량 실림(vol_ratio > 1.2)
// 성과: 평균 +1.55%, 승률 47.0% (표본 66건, 소표본 주의)
function detectContrarian(ind: Indicators): SignalResult | null {
  const { rsi14, vol_ratio20, bb_pct_b, momentum10d } = ind;
  if (rsi14 === null) return null;

  const factors: string[] = [];
  let score = 0;

  if (rsi14 < 35) {
    factors.push(`RSI ${rsi14.toFixed(1)} (강한 과매도 < 35)`);
    score += 50;
  } else if (rsi14 < 45) {
    factors.push(`RSI ${rsi14.toFixed(1)} (과매도 구간)`);
    score += 25;
  } else {
    return null; // RSI 45 이상이면 Contrarian 아님
  }

  if (vol_ratio20 !== null && vol_ratio20 > 1.2) {
    factors.push(`거래량 비율 ${vol_ratio20.toFixed(2)}× (실림)`);
    score += 30;
  } else if (vol_ratio20 !== null && vol_ratio20 > 0.8) {
    score += 10;
  }

  if (bb_pct_b !== null && bb_pct_b < 0.3) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 하단)`);
    score += 20;
  }

  if (momentum10d !== null && momentum10d < -5) {
    factors.push(`10일 모멘텀 ${momentum10d.toFixed(1)}% (사전 하락)`);
    score += 10;
  }

  score = Math.min(100, score);
  if (score < 50) return null;

  const conf = rsi14 < 35 && vol_ratio20 !== null && vol_ratio20 > 1.2 ? "HIGH" : "MED";
  return sig("AGGRESSIVE_CONTRARIAN", "많이 빠진 뒤 반등을 노릴 만한 구간", score, conf, 1.55, 1.27, factors);
}

// ── Volatility Squeeze ──────────────────────────────────────────────────
// 조건: BB폭 < 20% (변동성 응축)
// 성과: 평균 +1.03%, PF 1.56 (표본 841건, 가장 안정적)
function detectSqueeze(ind: Indicators): SignalResult | null {
  const { bb_width, atr_ratio, ma5_20_spread } = ind;
  if (bb_width === null) return null;

  const factors: string[] = [];
  let score = 0;

  if (bb_width < 15) {
    factors.push(`BB폭 ${bb_width.toFixed(1)}% (강한 응축 < 15%)`);
    score += 55;
  } else if (bb_width < 20) {
    factors.push(`BB폭 ${bb_width.toFixed(1)}% (응축 < 20%)`);
    score += 40;
  } else if (bb_width < 25) {
    factors.push(`BB폭 ${bb_width.toFixed(1)}% (수렴 중)`);
    score += 20;
  } else {
    return null;
  }

  if (atr_ratio !== null && atr_ratio < 5.0) {
    factors.push(`ATR비율 ${atr_ratio.toFixed(1)}% (낮음)`);
    score += 25;
  } else if (atr_ratio !== null && atr_ratio < 5.86) {
    // 5.86 = 보고서의 음(-) 평균, 이 이하가 양(+) 평균(5.30)에 가까움
    factors.push(`ATR비율 ${atr_ratio.toFixed(1)}% (보통)`);
    score += 12;
  }

  if (ma5_20_spread !== null && Math.abs(ma5_20_spread) < 2.47) {
    // 2.47 = 보고서의 양(+) 평균
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (과열 없음)`);
    score += 20;
  }

  score = Math.min(100, score);
  if (score < 40) return null;

  const conf = bb_width < 15 && (atr_ratio ?? 99) < 5.0 ? "HIGH" : "MED";
  return sig("VOLATILITY_SQUEEZE", "주가가 잠깐 조용해진 구간(폭발 전 잔잔함)", score, conf, 1.03, 1.56, factors);
}

// ── Oversold Rebound ────────────────────────────────────────────────────
// 조건: %B < 0.35 AND RSI < 50
// 성과: 평균 +1.01%, 승률 45.8% (표본 406건)
function detectOversoldRebound(ind: Indicators): SignalResult | null {
  const { bb_pct_b, rsi14, ma5_20_spread } = ind;
  if (bb_pct_b === null || rsi14 === null) return null;

  const factors: string[] = [];
  let score = 0;

  if (bb_pct_b < 0.2) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 하단 근접)`);
    score += 40;
  } else if (bb_pct_b < 0.35) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (하단 구간)`);
    score += 25;
  } else {
    return null;
  }

  if (rsi14 < 40) {
    factors.push(`RSI ${rsi14.toFixed(1)} (과매도)`);
    score += 35;
  } else if (rsi14 < 50) {
    factors.push(`RSI ${rsi14.toFixed(1)} (중립 이하)`);
    score += 20;
  } else {
    return null;
  }

  if (ma5_20_spread !== null && ma5_20_spread < 0) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (단기 눌림)`);
    score += 15;
  }

  score = Math.min(100, score);
  if (score < 40) return null;

  const conf = bb_pct_b < 0.2 && rsi14 < 40 ? "HIGH" : "MED";
  return sig("OVERSOLD_REBOUND", "너무 많이 빠진 뒤 소폭 반등을 기대할 수 있는 구간", score, conf, 1.01, 1.23, factors);
}

// ── Momentum Warning ────────────────────────────────────────────────────
// 조건: 단기 과열 (MA이격 큼, RSI 높음, 사전 모멘텀 양수)
// 성과: 평균 -0.35% (회피 권고)
function detectMomentumWarning(ind: Indicators): SignalResult | null {
  const { ma5_20_spread, rsi14, momentum10d, bb_pct_b } = ind;
  const factors: string[] = [];
  let score = 0;

  // ma5_20_spread > 2.61 = 보고서의 음(-) 평균
  if (ma5_20_spread !== null && ma5_20_spread > 4) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (과열 > 4%)`);
    score += 40;
  } else if (ma5_20_spread !== null && ma5_20_spread > 2.61) {
    factors.push(`이격도 ${ma5_20_spread.toFixed(2)}% (보고서 위험 구간)`);
    score += 20;
  }

  if (rsi14 !== null && rsi14 > 65) {
    factors.push(`RSI ${rsi14.toFixed(1)} (과매수)`);
    score += 35;
  } else if (rsi14 !== null && rsi14 > 55) {
    factors.push(`RSI ${rsi14.toFixed(1)} (모멘텀 고점권)`);
    score += 15;
  }

  if (momentum10d !== null && momentum10d > 5) {
    factors.push(`10일 모멘텀 +${momentum10d.toFixed(1)}% (사전 급등)`);
    score += 25;
  }

  // bb_pct_b > 0.64 = 보고서의 음(-) 평균
  if (bb_pct_b !== null && bb_pct_b > 0.8) {
    factors.push(`%B ${bb_pct_b.toFixed(2)} (밴드 상단)`);
    score += 20;
  }

  score = Math.min(100, score);
  if (score < 35) return null;

  const conf = score >= 70 ? "HIGH" : score >= 50 ? "MED" : "LOW";
  return sig("MOMENTUM_WARNING", "단기 급등·과열(무리한 추격 주의)", score, conf, -0.35, null, factors);
}

// ── 전체 시그널 탐지 ────────────────────────────────────────────────────
export function detectSignals(ind: Indicators): SignalResult[] {
  const candidates: (SignalResult | null)[] = [
    detectContrarian(ind),
    detectSqueeze(ind),
    detectOversoldRebound(ind),
    detectMomentumWarning(ind),
  ];

  const detected = candidates.filter((s): s is SignalResult => s !== null);
  // 강도 내림차순 정렬
  return detected.sort((a, b) => b.strength - a.strength);
}

export const NEUTRAL_SIGNAL: SignalResult = {
  type: "NEUTRAL",
  label: "특별히 두드러진 패턴 없음",
  strength: 30,
  confidence: "LOW",
  expected_return_pct: null,
  expected_pf: null,
  factors: ["조건 충족 시그널 없음"],
};
