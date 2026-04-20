/**
 * 복합 점수 + 등급 산정 — 바이오 소형주 특화 v2
 *
 * 대형주와 다른 바이오 소형주 특성:
 *  - 기본 변동성이 높음 (ATR 6~10%가 정상)
 *  - 카탈리스트(FDA·임상·공시)에 따른 거래량 급등이 잦음
 *  - 갭 오픈이 크고 방향성이 강함 (장전 뉴스·공시)
 *  - 이격도·모멘텀 정상 범위가 대형주보다 넓음
 *  - RSI는 AUC 0.507로 사실상 노이즈 → 독립 가중치 삭제
 *
 * 가중치 배분 (합계 100):
 *   atr 20, vol 18, vol_spike 15, spread 15, momentum 15, gap 10, bb 7
 *   (RSI는 시그널에서만 참조, 직접 점수화 안 함)
 *
 * 캘리브레이션: 20 + 0.80 × raw (기존 26+0.74보다 레인지 넓힘)
 * 표시 하한: 30 (기존 50은 위험 구간을 숨김 — 바이오는 리스크 가시화 필수)
 */

import type {
  Indicators,
  SignalResult,
  ScoreBreakdown,
  Grade,
  ArticleSentimentForScore,
} from "./types";

/** 긍정/부정만 반영. 신뢰도↑일수록 가감 폭↑(대략 ±4~±12). */
export function sentimentNudgePoints(
  input: ArticleSentimentForScore | null | undefined
): number {
  if (!input?.labelKo) return 0;
  const k = input.labelKo.trim();
  let sign = 0;
  if (k === "긍정") sign = 1;
  else if (k === "부정") sign = -1;
  else if (k.includes("중립") || k.includes("혼재")) return 0;
  else return 0;

  let c = input.confidence;
  if (c == null || !Number.isFinite(c)) c = 0.55;
  c = Math.min(1, Math.max(0.25, c));
  const magnitude = 12 * (0.35 + 0.65 * c);
  return Math.round(sign * magnitude);
}

// ── 개별 항목 점수 (0-100) ──────────────────────────────────────────────

/**
 * ATR 비율 점수 (가중치 20) — 바이오 소형주 보정
 * 대형주 기준 ATR 3-5%가 "좋음"이었으나 바이오 소형은 6-10%가 정상.
 * 임계값을 전체적으로 2-3%p 상향. ATR 8% 이하면 "응축" 판단.
 */
function atrScore(atr_ratio: number | null): number {
  if (atr_ratio === null) return 45;
  if (atr_ratio <= 4)    return 100;
  if (atr_ratio <= 6)    return 88;
  if (atr_ratio <= 8)    return 72;   // 바이오 정상 범위 상한
  if (atr_ratio <= 10)   return 55;   // 약간 높지만 바이오에선 흔함
  if (atr_ratio <= 14)   return 35;
  if (atr_ratio <= 20)   return 22;
  return 12;
}

/**
 * 거래량 비율 점수 (가중치 18) — 바이오 소형주 보정
 * 바이오는 카탈리스트에 거래량 2-3×가 빈번 → 이를 악재로만 보면 안 됨.
 * 5× 이상 대량 거래만 강한 경고. 1.5~3×는 중립~약한 경고.
 */
function volScore(vol_ratio: number | null): number {
  if (vol_ratio === null) return 50;
  if (vol_ratio < 0.4)   return 85;   // 거래 침체 — 관심 소외
  if (vol_ratio < 0.8)   return 78;   // 낮은 거래 — 변동성 응축
  if (vol_ratio < 1.2)   return 65;   // 정상
  if (vol_ratio < 2.0)   return 55;   // 바이오에서 흔한 소폭 증가
  if (vol_ratio < 3.5)   return 40;   // 관심 집중 — 방향 미정
  if (vol_ratio < 5.0)   return 28;
  if (vol_ratio < 8.0)   return 18;   // 과대 거래
  return 10;
}

/**
 * 거래량 스파이크 점수 (가중치 15) — 바이오 소형주 신규 팩터
 * 5일 평균 대비 당일 비율. 바이오는 카탈리스트에 거래량이 5-20× 튀는 경우가 많음.
 * 방향 중립(좋을 수도 나쁠 수도) → 극단 스파이크만 경고, 적정 스파이크는 양호.
 *
 * 해석: 적당한 스파이크(1.5-3×)는 시장 관심 = 좋은 신호,
 *       너무 큰 스파이크(>8×)는 패닉·투기 = 경고.
 */
function volSpikeScore(spike_ratio: number | null): number {
  if (spike_ratio === null) return 50;
  if (spike_ratio < 0.5)   return 35;   // 거래 극도로 적음 — 유동성 위험
  if (spike_ratio < 1.0)   return 50;   // 정상
  if (spike_ratio < 2.0)   return 65;   // 적당한 관심 증가
  if (spike_ratio < 3.5)   return 70;   // 카탈리스트성 관심 — 양호
  if (spike_ratio < 6.0)   return 55;   // 다소 과열
  if (spike_ratio < 10.0)  return 32;   // 투기·패닉 구간
  return 15;                             // 극단 스파이크 — 희석·작전·패닉 위험
}

/**
 * MA5-20 이격도 점수 (가중치 15) — 바이오 소형주 보정
 * 바이오 소형은 이격 ±5%가 일상적. 대형주 기준 3.5%를 "과열"로
 * 봤던 것을 6%로 상향. 음수(눌림)는 역발상 진입에 유리.
 */
function spreadScore(spread: number | null): number {
  if (spread === null) return 50;
  if (spread <= -5)   return 95;
  if (spread <= -2)   return 85;
  if (spread <=  2)   return 70;
  if (spread <=  6)   return 55;   // 바이오에선 흔한 이격
  if (spread <= 10)   return 35;
  if (spread <= 16)   return 20;
  return 12;
}

/**
 * 10일 모멘텀 점수 (가중치 15) — 바이오 소형주 보정
 * 바이오는 모멘텀 ±10%가 일상. 대형주 기준을 전체 2배 정도 확대.
 * 역발상(하락 후 반등) 방향 유지.
 */
function momentumScore(mom: number | null): number {
  if (mom === null) return 50;
  if (mom < -15) return 80;   // 바이오 급락 후 — 역발상 반등 기대
  if (mom <  -8) return 72;
  if (mom <  -3) return 65;
  if (mom <   3) return 55;   // 중립
  if (mom <   8) return 45;
  if (mom <  15) return 32;
  if (mom <  25) return 20;
  if (mom <  40) return 14;   // 바이오 급등 — 추격 매수 고위험
  return 8;
}

/**
 * 갭 오픈 점수 (가중치 10) — 바이오 소형주 신규 팩터
 * 장전 뉴스·공시에 따른 갭. 바이오 소형은 ±5~15% 갭이 빈번.
 *
 * 해석: 갭다운은 눌림(역발상 기회), 갭업은 추격 위험.
 *       극단 갭(>15%)은 방향 무관하게 경고(고변동 자체가 리스크).
 */
function gapScore(gap_pct: number | null): number {
  if (gap_pct === null) return 50;
  if (gap_pct < -10)  return 78;   // 큰 갭다운 — 오버슈트 반등 기대
  if (gap_pct < -5)   return 72;
  if (gap_pct < -2)   return 65;   // 적당한 갭다운 — 눌림 진입 구간
  if (gap_pct <  2)   return 55;   // 갭 없음 — 중립
  if (gap_pct <  5)   return 42;   // 소폭 갭업 — 관심 상승
  if (gap_pct <  10)  return 30;   // 중간 갭업 — 추격 부담
  if (gap_pct <  15)  return 20;   // 큰 갭업 — 고위험
  return 12;                        // 극단 갭업(>15%) — 투기·작전 경고
}

/**
 * BB %B 점수 (가중치 7) — 극단만 유효
 * AUC 0.526으로 분별력 약하나, 극단(0.1 이하·0.9 이상)에서만 약한 신호.
 * 가중치를 대폭 줄여 노이즈 영향 최소화.
 */
function bbScore(pct_b: number | null): number {
  if (pct_b === null) return 50;
  if (pct_b <= 0.10) return 85;
  if (pct_b <= 0.30) return 68;
  if (pct_b <= 0.60) return 55;
  if (pct_b <= 0.80) return 40;
  if (pct_b <= 0.90) return 25;
  return 15;
}

// ── 복합 점수 계산 ──────────────────────────────────────────────────────
export function computeScore(
  ind: Indicators,
  options?: { articleSentiment?: ArticleSentimentForScore | null }
): ScoreBreakdown {
  const w = { atr: 20, vol: 18, vol_spike: 15, spread: 15, momentum: 15, gap: 10, bb: 7 };

  const as_ = atrScore(ind.atr_ratio);
  const vs  = volScore(ind.vol_ratio20);
  const vss = volSpikeScore(ind.volume_spike_ratio);
  const ss  = spreadScore(ind.ma5_20_spread);
  const ms  = momentumScore(ind.momentum10d);
  const gs  = gapScore(ind.gap_pct);
  const bs  = bbScore(ind.bb_pct_b);

  const raw_weighted = Math.round(
    (as_ * w.atr + vs * w.vol + vss * w.vol_spike + ss * w.spread
      + ms * w.momentum + gs * w.gap + bs * w.bb) / 100
  );
  const calibrated = Math.round(
    20 + 0.80 * Math.min(100, Math.max(0, raw_weighted))
  );
  const sentiment_nudge = sentimentNudgePoints(options?.articleSentiment ?? undefined);
  /** 바이오 소형주는 위험 구간을 숨기면 안 됨 → 표시 하한 30 */
  const total = Math.min(100, Math.max(30, calibrated + sentiment_nudge));

  return {
    atr_score:      as_,
    vol_score:      vs,
    vol_spike_score: vss,
    spread_score:   ss,
    momentum_score: ms,
    gap_score:      gs,
    bb_score:       bs,
    raw_weighted,
    sentiment_nudge,
    total,
  };
}

// ── 등급 (바이오 소형주 보정) ────────────────────────────────────────────
export function gradeFromScore(
  displayTotal: number,
  signals: SignalResult[],
  raw_weighted?: number
): Grade {
  const hasWarning  = signals.some((s) => s.type === "MOMENTUM_WARNING");
  const hasDilution = signals.some((s) => s.type === "DILUTION_RISK");
  const hasPositive = signals.some((s) =>
    ["AGGRESSIVE_CONTRARIAN", "VOLATILITY_SQUEEZE", "OVERSOLD_REBOUND"].includes(s.type)
  );

  const highWarning = signals.some(
    (s) => s.type === "MOMENTUM_WARNING" && s.confidence === "HIGH"
  );
  const raw = raw_weighted ?? displayTotal;

  if (highWarning && raw < 15) return "D";
  if (hasDilution && raw < 30) return "D";

  const t = displayTotal;
  let g: Grade;
  if (t >= 78 && hasPositive && !hasWarning && !hasDilution) g = "A";
  else if (t >= 75 && hasPositive) g = "B";
  else if (t >= 62) g = "B";
  else if (t >= 45) g = "C";
  else g = "D";

  if (g === "D" && raw >= 20) g = "C";
  return g;
}
