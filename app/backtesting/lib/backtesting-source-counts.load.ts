import fs from "fs";
import path from "path";

import { loadSomedaynewsArticleTickersRecords } from "@/lib/somedaynews-json-source";

import type { BacktestingSourceCounts } from "./backtesting-source-counts.types";

const MANIFEST_REL = path.join("data", "eodhd_news_windows", "per_article", "manifest_per_article.json");

export async function loadBacktestingSourceCounts(rootDir = process.cwd()): Promise<BacktestingSourceCounts> {
  let articleTickerRecords: number | null = null;
  try {
    const records = await loadSomedaynewsArticleTickersRecords();
    articleTickerRecords = records.length;
  } catch {
    articleTickerRecords = null;
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
