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
  trend: QuantInsight["trend_filter"]
): string {
  if (grade === "D") {
    return trend.summary;
  }

  const signalDesc =
    primary.type === "AGGRESSIVE_CONTRARIAN"
      ? "가격이 많이 내렸다가 매매가 다시 붙는 구간으로 보입니다."
      : primary.type === "VOLATILITY_SQUEEZE"
        ? "최근에는 주가가 크게 오르내리지 않고 좁은 범위에 머물러 있습니다."
        : primary.type === "OVERSOLD_REBOUND"
          ? "단기로 너무 많이 빠진 뒤라, 조금 되돌릴 여지를 볼 수 있는 구간입니다."
          : primary.type === "MOMENTUM_WARNING"
            ? "최근에 너무 빨리 올라, 추격 매수는 부담스러울 수 있는 구간입니다."
            : primary.type === "NEUTRAL"
              ? ""
              : "눈에 띄는 패턴은 없고 무난한 상태에 가깝습니다.";

  const parts = [signalDesc.trim(), trend.summary.trim()].filter(Boolean);
  return parts.join(" ");
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
  const summary = buildSummary(grade, primary_signal, trend_filter);

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
