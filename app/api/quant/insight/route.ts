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
    const tickers = getTickersForArticle(article_id);
    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "No EOD data found for this article", article_id },
        { status: 404 }
      );
    }
    ticker = tickers[0];
  }

  const result = getBarsForQuantInsight(article_id, ticker);
  if (!result || result.bars.length === 0) {
    return NextResponse.json(
      { error: "EOD bars not found", article_id, ticker },
      { status: 404 }
    );
  }

  const { bars, t0_kst, bar_source } = result;
  // 마지막 봉 = 5m 집계면 발행 시각 직전까지 반영된 날, EOD면 발행일 포함 일봉
  const asOfDate = bars[bars.length - 1]?.date ?? (t0_kst ?? "");

  const sent = getArticleSentiment(article_id);
  const insight = computeQuantInsight(bars, ticker, asOfDate, {
    articleSentiment: sent
      ? { labelKo: sent.labelKo, confidence: sent.confidence }
      : null,
  });

  return NextResponse.json({
    article_id,
    t0_kst,
    bar_source,
    ...insight,
    ticker,
  });
}
