/**
 * 메인 퀀트 엔진
 * OhlcBar[] → QuantInsight
 */

import type { ArticleSentimentForScore, OhlcBar, QuantInsight } from "./types";
import { computeIndicators } from "./indicators";
import { detectSignals, NEUTRAL_SIGNAL } from "./signals";
import { computeScore, gradeFromScore } from "./scorer";
import { buildTrendFilter, buildEntryRecommendation } from "./filters";

function buildSummary(
  grade: QuantInsight["grade"],
  primary: QuantInsight["primary_signal"],
  trend: QuantInsight["trend_filter"],
  score: number
): string {
  if (grade === "D") {
    return `종합 점수 ${score}점 (D등급). ${trend.summary}. 진입 비권고.`;
  }

  const signalDesc =
    primary.type === "AGGRESSIVE_CONTRARIAN"
      ? "역발상(Contrarian) 시그널 포착."
      : primary.type === "VOLATILITY_SQUEEZE"
        ? "변동성 응축(Squeeze) 상태."
        : primary.type === "OVERSOLD_REBOUND"
          ? "과매도 반등 여건."
          : primary.type === "MOMENTUM_WARNING"
            ? "모멘텀 과열 주의."
            : "특이 시그널 없음.";

  return `종합 점수 ${score}점 (${grade}등급). ${signalDesc} ${trend.summary}.`;
}

export function computeQuantInsight(
  bars: OhlcBar[],
  ticker: string,
  asOfDate?: string,
  options?: { articleSentiment?: ArticleSentimentForScore | null }
): QuantInsight {
  const as_of_date = asOfDate ?? (bars.length > 0 ? bars[bars.length - 1].date : "");

  // 지표 계산
  const indicators = computeIndicators(bars);

  // 시그널 탐지
  const all_signals = detectSignals(indicators);
  const primary_signal = all_signals[0] ?? NEUTRAL_SIGNAL;

  // 복합 점수
  const score = computeScore(indicators, {
    articleSentiment: options?.articleSentiment ?? null,
  });
  const grade = gradeFromScore(score.total, all_signals, score.raw_weighted);

  // 트렌드 필터
  const trend_filter = buildTrendFilter(indicators);

  // 진입 추천
  const entry = buildEntryRecommendation(indicators, grade, bars);

  // 종합 코멘트
  const summary = buildSummary(grade, primary_signal, trend_filter, score.total);

  return {
    ticker,
    as_of_date,
    indicators,
    score,
    grade,
    primary_signal,
    all_signals,
    trend_filter,
    entry,
    summary,
  };
}
