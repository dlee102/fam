/**
 * Gemini 분류가 붙은 뉴스 JSON (증분 저장 결과)
 * data/somedaynews_article_tickers_classified.json
 */

import fs from "fs";
import path from "path";

export type ArticleSentimentSnapshot = {
  labelKo: string;
  sentiment?: string;
  confidence?: number;
  primaryTypeKo?: string;
  catalystLabelKo?: string;
  /** classified JSON `stock_catalyst` (e.g. bullish / bearish) */
  stockCatalyst?: string;
};

const CLASSIFIED_REL = path.join("data", "somedaynews_article_tickers_classified.json");

let _byArticleId: Map<string, ArticleSentimentSnapshot> | null = null;

function loadMap(): Map<string, ArticleSentimentSnapshot> {
  if (_byArticleId) return _byArticleId;
  _byArticleId = new Map();
  const filePath = path.join(process.cwd(), CLASSIFIED_REL);
  if (!fs.existsSync(filePath)) return _byArticleId;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!Array.isArray(raw)) return _byArticleId;
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const aid = r.article_id;
      const label = r.sentiment_label_ko;
      if (aid == null || typeof label !== "string" || !label.trim()) continue;
      const id = String(aid);
      if (_byArticleId.has(id)) continue;
      _byArticleId.set(id, {
        labelKo: label.trim(),
        sentiment: typeof r.sentiment === "string" ? r.sentiment : undefined,
        confidence: typeof r.sentiment_confidence === "number" ? r.sentiment_confidence : undefined,
        primaryTypeKo:
          typeof r.article_primary_type_ko === "string" ? r.article_primary_type_ko : undefined,
        catalystLabelKo:
          typeof r.stock_catalyst_label_ko === "string" ? r.stock_catalyst_label_ko : undefined,
        stockCatalyst: typeof r.stock_catalyst === "string" ? r.stock_catalyst : undefined,
      });
    }
  } catch {
    _byArticleId = new Map();
  }
  return _byArticleId;
}

/** 기사 ID 기준 첫 레코드의 감성·유형 (동일 기사 행은 동일 분류 가정) */
export function getArticleSentiment(articleId: string): ArticleSentimentSnapshot | null {
  if (!articleId) return null;
  return loadMap().get(articleId) ?? null;
}
