import fs from "fs";
import path from "path";
import type { BacktestingSourceCounts } from "./backtesting-source-counts.types";

const ARTICLES_REL = path.join("data", "somedaynews_article_tickers.json");
const MANIFEST_REL = path.join("data", "eodhd_news_windows", "per_article", "manifest_per_article.json");

export function loadBacktestingSourceCounts(rootDir = process.cwd()): BacktestingSourceCounts {
  let articleTickerRecords: number | null = null;
  const artPath = path.join(rootDir, ARTICLES_REL);
  if (fs.existsSync(artPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(artPath, "utf-8"));
      articleTickerRecords = Array.isArray(raw) ? raw.length : null;
    } catch {
      articleTickerRecords = null;
    }
  }

  let manifestRows: number | null = null;
  let manifestBothOk: number | null = null;
  const mfPath = path.join(rootDir, MANIFEST_REL);
  if (fs.existsSync(mfPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(mfPath, "utf-8"));
      if (Array.isArray(raw)) {
        manifestRows = raw.length;
        manifestBothOk = raw.filter((r: { eod_ok?: boolean; intraday_ok?: boolean }) => r.eod_ok && r.intraday_ok).length;
      }
    } catch {
      manifestRows = null;
      manifestBothOk = null;
    }
  }

  return { articleTickerRecords, manifestRows, manifestBothOk };
}
