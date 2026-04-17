/**
 * `data/analysis/article_news_scores.json` — 배치 생성: scripts/article_news_score.py
 * 행이 없으면 `computeNewsSignalScore`로 동일 규칙 즉시 계산 (모든 기사×티커 커버)
 */
import { readFile } from "fs/promises";
import path from "path";
import { computeNewsSignalScore } from "@/lib/news-signal-compute";
import type { NewsSignalScorePayload } from "@/lib/news-signal-types";

export type { NewsSignalScorePayload } from "@/lib/news-signal-types";

let cache: Map<string, NewsSignalScorePayload> | null = null;

function key(articleId: string, ticker: string): string {
  return `${articleId}:${ticker}`;
}

async function loadIndex(): Promise<Map<string, NewsSignalScorePayload>> {
  if (cache) return cache;
  const m = new Map<string, NewsSignalScorePayload>();
  const p = path.join(process.cwd(), "data/analysis/article_news_scores.json");
  try {
    const raw = JSON.parse(await readFile(p, "utf-8")) as {
      rows?: Array<{
        article_id?: string;
        ticker?: string;
        score_total?: number;
        breakdown?: NewsSignalScorePayload["breakdown"];
        flags?: Record<string, boolean>;
      }>;
    };
    for (const r of raw.rows ?? []) {
      const aid = typeof r.article_id === "string" ? r.article_id.trim() : "";
      const tk = typeof r.ticker === "string" ? r.ticker.trim() : "";
      if (!aid || !tk || r.score_total === undefined || !r.breakdown || !r.flags) continue;
      m.set(key(aid, tk), {
        score_total: r.score_total,
        breakdown: r.breakdown,
        flags: r.flags,
      });
    }
  } catch {
    /* 파일 없음·깨진 JSON → 빈 인덱스 후 런타임 계산 */
  }
  cache = m;
  return m;
}

/** 기사 ID + 종목 코드. JSON에 없어도 매니페스트·봉이 있으면 즉시 계산 */
export async function getNewsSignalScore(
  articleId: string,
  ticker: string
): Promise<NewsSignalScorePayload | null> {
  if (!articleId || !/^\d{6}$/.test(ticker)) return null;
  const idx = await loadIndex();
  const fromJson = idx.get(key(articleId, ticker));
  if (fromJson) return fromJson;
  try {
    return await computeNewsSignalScore(articleId, ticker);
  } catch {
    return null;
  }
}
