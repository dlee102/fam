import { NextRequest, NextResponse } from "next/server";
import { buildAllPostPublishSeries } from "@/lib/post-publish-curve";

/**
 * GET /api/article/post-publish-curve?article_id=...&tickers=115180,068270
 */
export async function GET(req: NextRequest) {
  const article_id = req.nextUrl.searchParams.get("article_id");
  const tickersRaw = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{6}$/.test(t));

  if (!article_id || tickers.length === 0) {
    return NextResponse.json(
      { error: "article_id and tickers (6-digit, comma-separated) required" },
      { status: 400 }
    );
  }

  const seriesNested = await Promise.all(
    tickers.map((t) => buildAllPostPublishSeries(article_id, t))
  );
  const series = seriesNested.flat();

  if (series.length === 0) {
    return NextResponse.json(
      { error: "no 5m post-publish series for this article/tickers", article_id, tickers },
      { status: 404 }
    );
  }

  return NextResponse.json({ article_id, series });
}
