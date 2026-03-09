/**
 * pharm_articles_manual_sentiment.json에서 티커 추출 → data/news_tickers.json 저장
 *
 * Run: npx tsx scripts/extract-news-tickers.ts
 */

import fs from "fs";
import path from "path";

const SENTIMENT_PATH = path.join(process.cwd(), "pharm_crawler", "pharm_articles_manual_sentiment.json");
const OUTPUT_PATH = path.join(process.cwd(), "data", "news_tickers.json");

interface SentimentArticle {
  url?: string;
  title?: string;
  tickers?: string[];
  published_date?: string;
}

function extractNewsId(url: string): string | null {
  const m = url.match(/newsId=([^&]+)/);
  return m ? m[1] : null;
}

function main() {
  if (!fs.existsSync(SENTIMENT_PATH)) {
    console.error("Not found:", SENTIMENT_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(SENTIMENT_PATH, "utf8");
  const articles: SentimentArticle[] = JSON.parse(raw);

  const entries: Array<{
    newsId: string;
    url: string;
    title: string;
    tickers: string[];
    published_date?: string;
  }> = [];
  const uniqueTickers = new Set<string>();

  for (const a of articles) {
    const tickers = a.tickers?.filter((t): t is string => typeof t === "string" && t.length > 0) ?? [];
    if (tickers.length === 0) continue;

    const url = a.url ?? "";
    const newsId = extractNewsId(url) ?? url;
    entries.push({
      newsId,
      url,
      title: a.title ?? "",
      tickers,
      published_date: a.published_date,
    });
    tickers.forEach((t) => uniqueTickers.add(t));
  }

  const output = {
    generated_at: new Date().toISOString(),
    source: "pharm_articles_manual_sentiment.json",
    total_articles: entries.length,
    unique_tickers: [...uniqueTickers].sort(),
    articles: entries,
  };

  const dataDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`Saved ${entries.length} articles, ${uniqueTickers.size} unique tickers → ${OUTPUT_PATH}`);
}

main();
