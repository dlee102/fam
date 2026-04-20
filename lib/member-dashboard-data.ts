/**
 * 유료 대시보드용 집계: 기사×(첫 EOD 티커)별 AI 퀀트 점수·등급·
 * 발행일(t0) 기준 EOD **5거래일 후 종가** 대비 누적 수익률(%).
 */

import { getArticleSentiment } from "@/lib/article-sentiment";
import { cumRetForwardTradingDaysFromPublish } from "@/lib/article-forward-cum-ret";
import {
  computeQuantInsight,
  getBarsForQuantInsight,
  getTickersForArticle,
} from "@/lib/quant-engine";
import { getSomedayNewsList } from "@/lib/somedaynews-articles";
import { getTickerName } from "@/lib/ticker-names";

export interface MemberRankingRow {
  article_id: string;
  title: string;
  published_at: string;
  ticker: string;
  ticker_name: string;
  score_total: number;
  grade: string;
  /** 발행일(t0) 종가 → 5거래일 후 종가 누적 %, 데이터 부족 시 null */
  cum_ret_pct: number | null;
  primary_label: string;
  bar_source: string;
}

function publishedAtMs(iso: string): number {
  const t = Date.parse(iso.replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}

/** 5거래일 누적 수익률 내림차순. null은 뒤로. 동률이면 AI 점수·최신 기사 순. */
export function compareMemberRankingByCumRetDesc(
  a: MemberRankingRow,
  b: MemberRankingRow
): number {
  const av = a.cum_ret_pct;
  const bv = b.cum_ret_pct;
  if (av == null && bv == null) {
    const ds = b.score_total - a.score_total;
    if (ds !== 0) return ds;
    return publishedAtMs(b.published_at) - publishedAtMs(a.published_at);
  }
  if (av == null) return 1;
  if (bv == null) return -1;
  const d = bv - av;
  if (Math.abs(d) > 1e-12) return d;
  const ds = b.score_total - a.score_total;
  if (ds !== 0) return ds;
  return publishedAtMs(b.published_at) - publishedAtMs(a.published_at);
}

export function sortMemberRankingsByCumRetDesc(rows: MemberRankingRow[]): MemberRankingRow[] {
  return [...rows].sort(compareMemberRankingByCumRetDesc);
}

const TRADING_DAYS_FORWARD = 5;

/** 발행 기준일 종가 → 5거래일 후 종가 누적 % */
export function cumRet5TradingDaysFromPublish(
  articleId: string,
  ticker: string
): Promise<number | null> {
  return cumRetForwardTradingDaysFromPublish(articleId, ticker, TRADING_DAYS_FORWARD);
}

async function buildOneArticleRow(item: {
  article_id: string;
  title: string;
  published_at: string;
}): Promise<MemberRankingRow | null> {
  const tickers = await getTickersForArticle(item.article_id);
  const ticker = tickers[0];
  if (!ticker) return null;

  const pack = await getBarsForQuantInsight(item.article_id, ticker);
  if (!pack?.bars.length) return null;

  const asOfDate = pack.bars[pack.bars.length - 1]?.date ?? "";
  const sent = getArticleSentiment(item.article_id);
  const insight = computeQuantInsight(pack.bars, ticker, asOfDate, {
    articleSentiment: sent
      ? { labelKo: sent.labelKo, confidence: sent.confidence }
      : null,
  });

  const cum5 = await cumRet5TradingDaysFromPublish(item.article_id, ticker);

  const row: MemberRankingRow = {
    article_id: item.article_id,
    title: item.title,
    published_at: item.published_at,
    ticker,
    ticker_name: getTickerName(ticker),
    score_total: insight.score.total,
    grade: insight.grade,
    cum_ret_pct: cum5 !== null && Number.isFinite(cum5) ? cum5 : null,
    primary_label: insight.primary_signal.label,
    bar_source: pack.bar_source,
  };

  return row;
}

export async function loadMemberDashboardData(options?: {
  maxArticles?: number;
  maxPairs?: number;
  /** 기사 단위 병렬 개수 (기본 12) */
  parallel?: number;
}): Promise<{ rankings: MemberRankingRow[] }> {
  const maxArticles = options?.maxArticles ?? 30;
  const maxPairs = options?.maxPairs ?? 10;
  const parallel = Math.max(1, Math.min(24, options?.parallel ?? 12));

  const { items } = await getSomedayNewsList({
    limit: maxArticles,
    requireIntradayOk: true,
  });

  const rankings: MemberRankingRow[] = [];

  for (let i = 0; i < items.length && rankings.length < maxPairs; i += parallel) {
    const batch = items.slice(i, i + parallel);
    const outs = await Promise.all(batch.map((item) => buildOneArticleRow(item)));
    for (const out of outs) {
      if (!out) continue;
      rankings.push(out);
      if (rankings.length >= maxPairs) break;
    }
  }

  return { rankings };
}
