/**
 * Quant V2 — 런타임 퀀트스코어 (로지스틱 회귀, `data/analysis/quant_v2_model.json`)
 *
 * `home_feed_quant_scores.json`에 없는 기사도 매니페스트·EOD·5분봉이 있으면 동일 피처로 점수 산출.
 * 배치 JSON은 LightGBM, 런타임 폴백은 학습 시 저장된 로지스틱 계수(해석·이식용) 사용.
 */
import quantV2Model from "@/data/analysis/quant_v2_model.json";
import { getArticleSentiment } from "@/lib/article-sentiment";
import { clampQuantV2ScorePoints } from "@/lib/quant-v2-score-cap";
import { extractNewsSignalFeatureRow, type NewsSignalRawFeatures } from "@/lib/news-signal-compute";
import { computeIndicators } from "@/lib/quant-engine/indicators";
import type { Indicators, OhlcBar } from "@/lib/quant-engine/types";
import { getHomeFeedQuantScore } from "@/lib/home-feed-quant-scores";

type LogisticBlock = {
  coefs: Record<string, number>;
  intercept: number;
  scaler_mean: Record<string, number>;
  scaler_scale: Record<string, number>;
};

type ModelFile = {
  selected_features?: string[];
  logistic: LogisticBlock;
  crash_risk?: LogisticBlock & {
    threshold_pct?: number;
    upside_threshold_pct?: number;
    crash_rate_train?: number;
    crash_rate_test?: number;
    train_auc?: number;
    test_auc?: number;
  };
};

function sigmoid(z: number): number {
  if (z > 35) return 1;
  if (z < -35) return 0;
  return 1 / (1 + Math.exp(-z));
}

function assembleFeatureMap(
  news: NewsSignalRawFeatures,
  ind: Indicators,
  catalystBullish: number
): Record<string, number> {
  return {
    entry_vs_prev_close: news.entry_vs_prev_close,
    entry_vs_prev_low: news.entry_vs_prev_low ?? 0,
    gap_open_pct: news.gap_open_pct ?? 0,
    pub_hour: news.pub_hour ?? 0,
    ma5_20_spread: ind.ma5_20_spread ?? 0,
    pub_weekday: news.pub_weekday ?? 0,
    close_vs_ma20: news.close_vs_ma20 ?? 0,
    rsi14: ind.rsi14 ?? 0,
    momentum10d: ind.momentum10d ?? 0,
    catalyst_bullish: catalystBullish,
    ret_1d_pre: news.ret_1d_pre ?? 0,
    vol_spike_ratio: ind.volume_spike_ratio ?? 0,
    vol_ratio20: ind.vol_ratio20 ?? 0,
  };
}

/**
 * 로지스틱 모델로 0~99 퀀트스코어(100 미표시). 피처·EOD 부족 시 null.
 */
export async function computeQuantV2LogisticScore(
  articleId: string,
  ticker: string
): Promise<number | null> {
  if (!articleId?.trim() || !/^\d{6}$/.test(ticker)) return null;

  const row = await extractNewsSignalFeatureRow(articleId, ticker);
  if (!row) return null;

  const { i0, eod } = row;
  // 짧은 EOD 히스토리도 뉴스 피처+지표 null→0으로 점수 산출 (구버전은 20일 미만 시 null).
  if (i0 < 1) return null;

  const preBars: OhlcBar[] = eod.slice(0, i0).map((b) => ({
    ...b,
    volume: Number.isFinite(b.volume) ? b.volume : 0,
  }));
  if (preBars.length < 1) return null;

  const ind = computeIndicators(preBars);
  const sent = getArticleSentiment(articleId);
  const catalystBullish = sent?.stockCatalyst === "bullish" ? 1 : 0;

  const m = quantV2Model as ModelFile;
  const logistic = m.logistic;
  const featMap = assembleFeatureMap(row.features, ind, catalystBullish);
  const names =
    m.selected_features && m.selected_features.length > 0
      ? m.selected_features
      : (Object.keys(logistic.coefs) as string[]);

  let z = logistic.intercept;
  for (const name of names) {
    const x = featMap[name] ?? 0;
    const mean = logistic.scaler_mean[name] ?? 0;
    const scale = logistic.scaler_scale[name] ?? 1;
    const coef = logistic.coefs[name] ?? 0;
    z += coef * ((x - mean) / (scale === 0 ? 1 : scale));
  }

  const p = sigmoid(z);
  return clampQuantV2ScorePoints(p * 100);
}

/**
 * 폭락 위험 점수 (0~99, 100 미표시). crash_risk 로지스틱 모델 사용.
 * 점수가 높을수록 ret_1d < -5% 가능성이 높다고 봄.
 */
export async function computeQuantV2CrashRisk(
  articleId: string,
  ticker: string
): Promise<number | null> {
  if (!articleId?.trim() || !/^\d{6}$/.test(ticker)) return null;

  const m = quantV2Model as ModelFile;
  if (!m.crash_risk) return null;
  const cr = m.crash_risk;

  const row = await extractNewsSignalFeatureRow(articleId, ticker);
  if (!row) return null;
  const { i0, eod } = row;
  if (i0 < 1) return null;

  const preBars: OhlcBar[] = eod.slice(0, i0).map((b) => ({
    ...b,
    volume: Number.isFinite(b.volume) ? b.volume : 0,
  }));
  if (preBars.length < 1) return null;

  const ind = computeIndicators(preBars);
  const sent = getArticleSentiment(articleId);
  const catalystBullish = sent?.stockCatalyst === "bullish" ? 1 : 0;
  const featMap = assembleFeatureMap(row.features, ind, catalystBullish);

  const names = m.selected_features && m.selected_features.length > 0
    ? m.selected_features
    : Object.keys(cr.coefs);

  let z = cr.intercept;
  for (const name of names) {
    const x = featMap[name] ?? 0;
    const mean = cr.scaler_mean[name] ?? 0;
    const scale = cr.scaler_scale[name] === 0 ? 1 : (cr.scaler_scale[name] ?? 1);
    const coef = cr.coefs[name] ?? 0;
    z += coef * ((x - mean) / scale);
  }
  return clampQuantV2ScorePoints(sigmoid(z) * 100);
}

/**
 * 최종 퀀트스코어 = 양전확률 × (1 − 폭락위험).
 * 양전: 번들 JSON(LightGBM) 우선 → 없으면 로지스틱 런타임.
 * 폭락: crash_risk 로지스틱 런타임 (항상 실시간). 모델 없으면 페널티 없음.
 */
export async function getQuantV2ScoreForArticle(
  articleId: string,
  ticker: string | undefined
): Promise<number | null> {
  const validTicker = ticker && /^\d{6}$/.test(ticker) ? ticker : null;

  const [upside, crash] = await Promise.all([
    (async (): Promise<number | null> => {
      const cached = getHomeFeedQuantScore(articleId);
      if (cached !== null) return cached;
      if (!validTicker) return null;
      return computeQuantV2LogisticScore(articleId, validTicker);
    })(),
    validTicker
      ? computeQuantV2CrashRisk(articleId, validTicker)
      : Promise.resolve(null),
  ]);

  if (upside === null) return null;
  if (crash === null) return upside;
  // 양전(0~99) × (1 − 폭락). 폭락이 클수록 점수가 떨어짐.
  return clampQuantV2ScorePoints(Math.round(upside * (1 - crash / 100)));
}
