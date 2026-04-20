/**
 * 홈 피드(`app/page.tsx`)와 동일 집합만 점수 계산해 `data/home_feed_quant_scores.json`에 반영합니다.
 * — `getSomedayNewsList({ limit: 150, requireIntradayOk: true })` = 5분봉(EODHD) 매니페스트 연동 기사 중 최신 150건
 * — 티커는 홈과 같이 `getTickersForArticle` 첫 번째(매니페스트 순)
 *
 * 기존 `scores`와 병합(이번에 계산한 article_id만 덮어씀). 전 기사 전량 계산은 하지 않음.
 *
 * 실행: npm run home-feed-quant-scores
 *
 * 우선순위: V2 로지스틱 → 기술 총점 → 50
 */

import fs from "fs";
import path from "path";
import { getArticleSentiment } from "../lib/article-sentiment";
import { clampQuantV2ScorePoints } from "../lib/quant-v2-score-cap";
import { computeQuantV2LogisticScore } from "../lib/quant-v2-prediction";
import {
  computeQuantInsight,
  getArticleIdsWithIntradayManifestOk,
  getBarsForQuantInsight,
  getTickersForArticle,
  hasRealIntradayData,
} from "../lib/quant-engine";
import { getSomedayNewsList } from "../lib/somedaynews-articles";

/** `app/page.tsx` 의 `LIST_LIMIT` 와 맞출 것 */
const LIST_LIMIT = 150;

const LOCAL_TICKERS = path.join(process.cwd(), "data", "somedaynews_article_tickers.json");
const OUT = path.join(process.cwd(), "data", "home_feed_quant_scores.json");
const PARALLEL = 10;
const NEUTRAL_FALLBACK = 50;

type ScoreKind = "v2" | "tech" | "neutral";

interface RawRow {
  article_id?: string;
  published_at?: string;
  stock_codes?: string[];
}

function normalizeRecords(raw: unknown): RawRow[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((r) => r && typeof r === "object") as RawRow[];
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    return keys.map((k) => o[k]).filter((r): r is RawRow => Boolean(r && typeof r === "object"));
  }
  return [];
}

function parsePublishedAt(iso: string | undefined): number {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * SomedayNews dedupe + 발행일 최신순 (getSomedayNewsList 와 동일 순서)
 */
function dedupeNewestFirst(records: RawRow[]): { article_id: string; published_at: string; stock_codes: string[] }[] {
  const byId = new Map<string, { codes: string[]; published_at: string }>();

  for (const row of records) {
    if (!row.article_id) continue;
    const codes = [...new Set(row.stock_codes ?? [])];
    const cur = byId.get(row.article_id);
    if (!cur) {
      byId.set(row.article_id, { codes, published_at: row.published_at ?? "" });
      continue;
    }
    const merged = [...new Set([...cur.codes, ...codes])];
    let published_at = cur.published_at;
    if (parsePublishedAt(row.published_at) > parsePublishedAt(cur.published_at)) {
      published_at = row.published_at ?? "";
    }
    byId.set(row.article_id, { codes: merged, published_at });
  }

  return [...byId.entries()]
    .map(([article_id, v]) => ({
      article_id,
      published_at: v.published_at,
      stock_codes: v.codes,
    }))
    .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at));
}

async function resolveHomeFeedBatchTargets(): Promise<{ article_id: string; ticker: string }[]> {
  const { items } = await getSomedayNewsList({
    limit: LIST_LIMIT,
    requireIntradayOk: true,
  });

  if (items.length > 0) {
    const out: { article_id: string; ticker: string }[] = [];
    for (const it of items) {
      const tickers = await getTickersForArticle(it.article_id);
      const ticker = tickers[0];
      if (ticker) out.push({ article_id: it.article_id, ticker });
    }
    return out;
  }

  if (!fs.existsSync(LOCAL_TICKERS)) {
    console.error(
      "SomedayNews가 비어 있고 로컬 tickers JSON도 없습니다. Firebase Admin(.env) 또는 data/somedaynews_article_tickers.json 을 확인하세요."
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(LOCAL_TICKERS, "utf8")) as unknown;
  const records = normalizeRecords(raw);
  const deduped = dedupeNewestFirst(records);
  const manifestIds = await getArticleIdsWithIntradayManifestOk();
  const filtered = deduped.filter((a) => manifestIds.has(a.article_id)).slice(0, LIST_LIMIT);

  const out: { article_id: string; ticker: string }[] = [];
  for (const row of filtered) {
    const tickers = await getTickersForArticle(row.article_id);
    const ticker = tickers[0] ?? row.stock_codes[0];
    if (ticker) out.push({ article_id: row.article_id, ticker });
  }
  return out;
}

async function scoreOne(articleId: string, ticker: string): Promise<{ score: number; kind: ScoreKind }> {
  const v2 = await computeQuantV2LogisticScore(articleId, ticker);
  if (v2 !== null) return { score: v2, kind: "v2" };

  const real5m = await hasRealIntradayData(articleId, ticker);
  if (!real5m) return { score: NEUTRAL_FALLBACK, kind: "neutral" };

  const qi = await getBarsForQuantInsight(articleId, ticker);
  if (!qi?.bars?.length) return { score: NEUTRAL_FALLBACK, kind: "neutral" };

  const sent = getArticleSentiment(articleId);
  const asOfDate = qi.bars[qi.bars.length - 1]?.date ?? qi.t0_kst ?? "";
  const insight = computeQuantInsight(qi.bars, ticker, asOfDate, {
    articleSentiment: sent ? { labelKo: sent.labelKo, confidence: sent.confidence } : null,
  });
  const s = clampQuantV2ScorePoints(insight.score.total);
  return { score: s, kind: "tech" };
}

async function main() {
  const targets = await resolveHomeFeedBatchTargets();
  console.log(
    `홈과 동일: 매니페스트 5분 연동 중 최신 ${LIST_LIMIT}건 → 실제 점수 대상 ${targets.length}건`
  );

  let prevScores: Record<string, number> = {};
  if (fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, "utf8")) as { scores?: Record<string, number> };
      prevScores = prev.scores ?? {};
    } catch {
      /* ignore */
    }
  }

  const batchScores: Record<string, number> = {};
  let nV2 = 0;
  let nTech = 0;
  let nNeutral = 0;

  for (let i = 0; i < targets.length; i += PARALLEL) {
    const batch = targets.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((it) => scoreOne(it.article_id, it.ticker)));

    batch.forEach((it, j) => {
      const r = results[j]!;
      batchScores[it.article_id] = r.score;
      if (r.kind === "v2") nV2++;
      else if (r.kind === "tech") nTech++;
      else nNeutral++;
    });
  }

  const merged = { ...prevScores, ...batchScores };

  const payload = {
    generated_at: new Date().toISOString(),
    source: `home feed batch only: latest ${LIST_LIMIT} manifest articles (merge into scores)`,
    batch_stats: { v2_logistic: nV2, technical_fallback: nTech, neutral_50: nNeutral, batch_count: targets.length },
    count: Object.keys(merged).length,
    scores: merged,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`→ ${OUT}`);
  console.log(JSON.stringify(payload.batch_stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
