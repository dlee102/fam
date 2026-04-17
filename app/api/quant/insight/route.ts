/**
 * GET /api/quant/insight?article_id=XXX&ticker=115180
 *
 * 기사 ID + 종목 코드를 받아 퀀트 인사이트 JSON 반환.
 * 종목 코드 없이 article_id만 넘기면 첫 번째 유효 티커로 자동 선택.
 */

import { NextRequest, NextResponse } from "next/server";
import { getArticleSentiment } from "@/lib/article-sentiment";
import {
  getBarsForQuantInsight,
  getTickersForArticle,
  computeQuantInsight,
} from "@/lib/quant-engine";
import { getFundamentalSnapshotForTicker, computeFundamentalScore } from "@/lib/quant-fundamentals";
import { getNewsSignalScore } from "@/lib/news-signal-score";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const article_id = searchParams.get("article_id");
  let ticker = searchParams.get("ticker") ?? "";

  if (!article_id) {
    return NextResponse.json(
      { error: "article_id is required" },
      { status: 400 }
    );
  }

  // ticker 미지정이면 첫 번째 유효 티커 사용
  if (!ticker) {
    const tickers = await getTickersForArticle(article_id);
    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "No EOD+5m manifest row for this article", article_id },
        { status: 404 }
      );
    }
    ticker = tickers[0];
  }

  const result = await getBarsForQuantInsight(article_id, ticker);
  if (!result || result.bars.length === 0) {
    return NextResponse.json(
      { error: "5m bars missing or aggregation empty", article_id, ticker },
      { status: 404 }
    );
  }

  const { bars, t0_kst, bar_source } = result;
  // 마지막 봉 = 발행 시각 직전까지 반영된 거래일
  const asOfDate = bars[bars.length - 1]?.date ?? (t0_kst ?? "");

  const sent = getArticleSentiment(article_id);
  const insight = computeQuantInsight(bars, ticker, asOfDate, {
    articleSentiment: sent
      ? { labelKo: sent.labelKo, confidence: sent.confidence }
      : null,
  });

  const fundamentals_snapshot = getFundamentalSnapshotForTicker(ticker);
  const fundamental_score = fundamentals_snapshot
    ? computeFundamentalScore(fundamentals_snapshot)
    : null;

  let news_signal: Awaited<ReturnType<typeof getNewsSignalScore>> = null;
  try {
    news_signal = await getNewsSignalScore(article_id, ticker);
  } catch {
    news_signal = null;
  }

  return NextResponse.json({
    article_id,
    t0_kst,
    bar_source,
    news_signal,
    article_sentiment: sent
      ? {
          label_ko: sent.labelKo,
          primary_type_ko: sent.primaryTypeKo ?? null,
          catalyst_label_ko: sent.catalystLabelKo ?? null,
        }
      : null,
    fundamentals_snapshot,
    fundamental_score,
    ...insight,
    ticker,
  });
}
