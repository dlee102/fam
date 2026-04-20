/**
 * 퀀트 엔진 Public API
 *
 * 사용 예)
 *   import { computeQuantInsight, getBarsThroughPublishDate } from "@/lib/quant-engine";
 *   const r = await getBarsThroughPublishDate(article_id, ticker);
 *   const { bars, t0_kst } = r ?? { bars: [], t0_kst: null };
 *   const insight = computeQuantInsight(bars, ticker, bars[bars.length - 1]?.date);
 */

export type {
  ArticleSentimentForScore,
  OhlcBar,
  Indicators,
  SignalType,
  Confidence,
  SignalResult,
  TrendFilter,
  EntryRecommendation,
  ScoreBreakdown,
  Grade,
  QuantInsight,
} from "./types";

export { computeIndicators } from "./indicators";
export { detectSignals, NEUTRAL_SIGNAL } from "./signals";
export { computeScore, gradeFromScore, sentimentNudgePoints } from "./scorer";
export { buildTrendFilter, buildEntryRecommendation } from "./filters";
export { computeQuantInsight } from "./engine";
export {
  loadEodBars,
  getBarsThroughPublishDate,
  getBarsForQuantInsight,
  getPreNewsBars,
  getTickersForArticle,
  findManifestRow,
  getLatestDailySnapshotForTicker,
  getArticleIdsWithEodOk,
  getArticleIdsWithIntradayManifestOk,
  hasRealIntradayData,
} from "./eod-loader";
export type { QuantInsightBarSource } from "./eod-loader";
