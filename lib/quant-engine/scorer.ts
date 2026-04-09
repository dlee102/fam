/**
 * 복합 점수 + 등급 산정 (재설계 v2 + 캘리브레이션)
 *
 * 실증: WIN/LOSS AUC가 대부분 0.52~0.57 → **극단 부분점(5·8·10)만으로 13점** 같은 값은
 * “승률 예측”으로 과대 해석됨. **양전 표본**에도 고변동·고거래량이 흔함.
 *
 * 따라서:
 * 1) 부분점 꼬리는 다소 완화(최악 구간도 15~24대)
 * 2) `raw_weighted` 가중합 후 캘리브레이션 → 기사 AI 톤(긍정/부정)에 **소폭 가감** → 표시 `total`은 **최소 50**.
 * 3) 등급은 표시 `total`(캘리브레이션·기사 톤 가감 반영) 기준으로 구간을 나눔.
 *    (구 raw 73/53/34에 대응하는 구간은 cal=26+0.74·raw → 약 80/65/51)
 * 4) 극단만 `raw_weighted`로 D 고정(high 경고·극저 raw).
 *
 * 가중치: atr 30, vol 25, spread 20, momentum 10, bb 10, rsi 5
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
 * ATR 비율 점수 (가중치 30) — AUC 0.569, 가장 유효
 * WIN 중앙값 6.70% vs LOSS 7.09%. 낮을수록 변동성 응축 → WIN 경향.
 * 실제 데이터: 한국 소형 바이오 평균 ATR≈6~8%, 10% 이상이면 고변동.
 */
function atrScore(atr_ratio: number | null): number {
  if (atr_ratio === null) return 45;
  if (atr_ratio <= 3)    return 100;
  if (atr_ratio <= 5)    return 85;
  if (atr_ratio <= 6.5)  return 70;
  if (atr_ratio <= 7.1)  return 55;
  if (atr_ratio <= 10)   return 32;
  if (atr_ratio <= 18)   return 22;  // 고변동 — 악재이나 AUC 약해 극단값 지양
  return 15;
}

/**
 * 거래량 비율 점수 (가중치 25) — 거래량 과대가 강한 악재 신호
 * 구간별 실측 T+1 양전율: <0.5→49.5%, 0.5-1→46.3%, 1-2→38.5%, 2-5→37.9%, >5→25.0%
 * 즉 거래량이 평소보다 적을수록 좋고, 과대할수록 악재.
 */
function volScore(vol_ratio: number | null): number {
  if (vol_ratio === null) return 50;
  if (vol_ratio < 0.5)   return 90;
  if (vol_ratio < 1.0)   return 80;
  if (vol_ratio < 1.5)   return 60;
  if (vol_ratio < 2.0)   return 45;
  if (vol_ratio < 3.5)   return 28;
  if (vol_ratio < 5.0)   return 20;   // 4~5× — 불리 경향, 다만 양전 종목도 다수
  return 12;
}

/**
 * MA5-20 이격도 점수 (가중치 20) — AUC 0.529
 * WIN 중앙값 1.54% vs LOSS 3.46%. 낮거나 음수(눌림)일수록 유리.
 */
function spreadScore(spread: number | null): number {
  if (spread === null) return 50;
  if (spread <= -3)   return 100;
  if (spread <= -1)   return 90;
  if (spread <=  1.5) return 75;
  if (spread <=  3.5) return 55;
  if (spread <=  6)   return 32;
  if (spread <= 10)   return 22;
  if (spread <= 16)   return 18;    // 과열 — 양전 바이오에서도 흔함
  return 14;
}

/**
 * 10일 모멘텀 점수 (가중치 10) — AUC 0.525
 * WIN 중앙값 4.9% vs LOSS 6.2%. 낮을수록(역발상) 미세하게 유리.
 * 단, 극적 하락도 리스크이므로 완전히 선형은 아님.
 */
function momentumScore(mom: number | null): number {
  if (mom === null) return 50;
  if (mom < -10) return 85;
  if (mom <  -5) return 75;
  if (mom <   0) return 65;
  if (mom <   3) return 55;
  if (mom <   5) return 48;
  if (mom <   8) return 35;
  if (mom <  15) return 22;
  if (mom <  30) return 16;   // 급등 구간 — 경고이나 단기 양전과 공존
  return 12;
}

/**
 * BB %B 점수 (가중치 10) — AUC 0.526, WIN=LOSS≈0.70
 * 실증 구별력 매우 약함. WIN=LOSS=0.70으로 중앙값이 동일.
 * 극단 구간(0.90 이상)에서 약한 악재 신호만 존재.
 */
function bbScore(pct_b: number | null): number {
  if (pct_b === null) return 50;
  if (pct_b <= 0.15) return 80;   // 밴드 극하단 (과매도)
  if (pct_b <= 0.40) return 65;
  if (pct_b <= 0.70) return 55;   // WIN·LOSS 중앙값 구간 — 중립
  if (pct_b <= 0.85) return 40;
  return 20;                        // 밴드 극상단 — 과매수
}

/**
 * RSI 점수 (가중치 5) — AUC 0.507, 사실상 무의미
 * WIN 56.7 vs LOSS 58.9. 차이가 매우 작음.
 * 극단값(RSI < 30 / > 75)에서만 미약한 신호 유지.
 */
function rsiScore(rsi: number | null): number {
  if (rsi === null) return 50;
  if (rsi < 25) return 90;   // 극과매도 — 반등 여지
  if (rsi < 35) return 70;
  if (rsi < 50) return 58;
  if (rsi < 65) return 45;
  if (rsi < 75) return 30;
  return 15;                   // 극과매수
}

// ── 복합 점수 계산 ──────────────────────────────────────────────────────
export function computeScore(
  ind: Indicators,
  options?: { articleSentiment?: ArticleSentimentForScore | null }
): ScoreBreakdown {
  const w = { atr: 30, vol: 25, spread: 20, momentum: 10, bb: 10, rsi: 5 };

  const as_ = atrScore(ind.atr_ratio);
  const vs  = volScore(ind.vol_ratio20);
  const ss  = spreadScore(ind.ma5_20_spread);
  const ms  = momentumScore(ind.momentum10d);
  const bs  = bbScore(ind.bb_pct_b);
  const rs  = rsiScore(ind.rsi14);

  const raw_weighted = Math.round(
    (as_ * w.atr + vs * w.vol + ss * w.spread + ms * w.momentum + bs * w.bb + rs * w.rsi) / 100
  );
  const calibrated = Math.round(
    26 + 0.74 * Math.min(100, Math.max(0, raw_weighted))
  );
  const sentiment_nudge = sentimentNudgePoints(options?.articleSentiment ?? undefined);
  /** 정책: 톤 가감 후에도 표시 최소 50 */
  const total = Math.min(100, Math.max(50, calibrated + sentiment_nudge));

  return {
    atr_score:      as_,
    vol_score:      vs,
    spread_score:   ss,
    momentum_score: ms,
    bb_score:       bs,
    rsi_score:      rs,
    raw_weighted,
    sentiment_nudge,
    total,
  };
}

// ── 등급 (화면 총점 `total`과 동일 축 — 혼란 방지) ───────────────────────
export function gradeFromScore(
  displayTotal: number,
  signals: SignalResult[],
  raw_weighted?: number
): Grade {
  const hasWarning  = signals.some((s) => s.type === "MOMENTUM_WARNING");
  const hasPositive = signals.some((s) =>
    ["AGGRESSIVE_CONTRARIAN", "VOLATILITY_SQUEEZE", "OVERSOLD_REBOUND"].includes(s.type)
  );

  const highWarning = signals.some(
    (s) => s.type === "MOMENTUM_WARNING" && s.confidence === "HIGH"
  );
  const raw = raw_weighted ?? displayTotal;

  /** 구조적 극단만 raw로 D (표시 점수가 높아도 덮지 않음) */
  if (highWarning && raw < 12) return "D";

  const t = displayTotal;
  let g: Grade;
  /** 구 과제점 기준 raw≥73/53/34 → cal 약 80/65/51 에 맞춘 표시 총점 구간 */
  if (t >= 80 && hasPositive && !hasWarning) g = "A";
  else if (t >= 80 && hasPositive) g = "B";
  else if (t >= 65) g = "B";
  else if (t >= 51) g = "C";
  else g = "D";

  if (g === "D" && raw >= 18) g = "C";
  return g;
}
