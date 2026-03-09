/**
 * 뉴스에서 추출된 티커 데이터 로드
 * data/news_tickers.json
 */

import fs from "fs";
import path from "path";

export interface NewsTickerEntry {
  newsId: string;
  url: string;
  title: string;
  tickers: string[];
  published_date?: string;
}

export interface NewsTickersData {
  generated_at: string;
  source: string;
  total_articles: number;
  unique_tickers: string[];
  articles: NewsTickerEntry[];
}

let _cached: NewsTickersData | null = null;

export function loadNewsTickers(): NewsTickersData {
  if (_cached) return _cached;
  const filePath = path.join(process.cwd(), "data", "news_tickers.json");
  if (!fs.existsSync(filePath)) {
    return {
      generated_at: "",
      source: "",
      total_articles: 0,
      unique_tickers: [],
      articles: [],
    };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    _cached = JSON.parse(raw) as NewsTickersData;
  } catch {
    _cached = { generated_at: "", source: "", total_articles: 0, unique_tickers: [], articles: [] };
  }
  return _cached;
}

/** 특정 뉴스 기사의 티커 목록 */
export function getTickersByNewsId(newsId: string): string[] {
  const data = loadNewsTickers();
  const entry = data.articles.find((a) => a.newsId === newsId);
  return entry?.tickers ?? [];
}

/** 특정 뉴스 기사 엔트리 (티커, 발행일) */
export function getArticleByNewsId(newsId: string): NewsTickerEntry | null {
  const data = loadNewsTickers();
  return data.articles.find((a) => a.newsId === newsId) ?? null;
}

/** 전체 고유 티커 목록 */
export function getUniqueTickers(): string[] {
  return loadNewsTickers().unique_tickers;
}
