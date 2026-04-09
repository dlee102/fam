/**
 * SomedayNews API로 적재된 뉴스 메타데이터
 * data/somedaynews_article_tickers.json
 */

import fs from "fs";
import path from "path";

import { decodeHtmlEntities } from "@/lib/decode-html-entities";
import { getArticleIdsWithIntradayManifestOk } from "@/lib/quant-engine/eod-loader";

interface SomedayNewsArticleRecord {
  date: string;
  published_at: string;
  article_id: string;
  title: string;
  stock_codes: string[];
  registered_date: string;
}

export interface SomedayNewsListItem {
  article_id: string;
  title: string;
  published_at: string;
  stock_codes: string[];
}

const DATA_REL = path.join("data", "somedaynews_article_tickers.json");

let _deduped: SomedayNewsListItem[] | null = null;
let _byArticleId: Map<string, SomedayNewsListItem> | null = null;

function parsePublishedAt(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function dedupeAll(records: SomedayNewsArticleRecord[]): SomedayNewsListItem[] {
  const byId = new Map<string, SomedayNewsListItem>();

  for (const row of records) {
    if (!row.article_id || !row.title) continue;
    const cur = byId.get(row.article_id);
    const codes = new Set(row.stock_codes ?? []);
    if (!cur) {
      byId.set(row.article_id, {
        article_id: row.article_id,
        title: decodeHtmlEntities(row.title.trim()),
        published_at: row.published_at,
        stock_codes: [...codes],
      });
      continue;
    }
    for (const c of row.stock_codes ?? []) cur.stock_codes.push(c);
    cur.stock_codes = [...new Set(cur.stock_codes)];
    if (parsePublishedAt(row.published_at) > parsePublishedAt(cur.published_at)) {
      cur.published_at = row.published_at;
    }
  }

  return [...byId.values()].sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at));
}

function loadDeduped(): SomedayNewsListItem[] {
  if (_deduped) return _deduped;
  const filePath = path.join(process.cwd(), DATA_REL);
  if (!fs.existsSync(filePath)) {
    _deduped = [];
    _byArticleId = null;
    return _deduped;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const records = JSON.parse(raw) as SomedayNewsArticleRecord[];
    _deduped = Array.isArray(records) ? dedupeAll(records) : [];
  } catch {
    _deduped = [];
  }
  _byArticleId = null;
  return _deduped;
}

function getByArticleIdMap(): Map<string, SomedayNewsListItem> {
  if (_byArticleId) return _byArticleId;
  const list = loadDeduped();
  _byArticleId = new Map(list.map((a) => [a.article_id, a]));
  return _byArticleId;
}

export function getSomedayNewsByArticleId(articleId: string): SomedayNewsListItem | null {
  if (!articleId) return null;
  return getByArticleIdMap().get(articleId) ?? null;
}

/** 차트 API용 YYYY-MM-DD (ISO 문자열에서 날짜만) */
export function somedayNewsDateForChart(publishedAt: string): string {
  const d = publishedAt.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return publishedAt.replace(/-/g, "").slice(0, 8);
  const x = new Date(t);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 발행일 기준 최신순, 동일 기사(article_id)는 티커만 합친 한 줄 */
export async function getSomedayNewsList(options?: {
  limit?: number;
  /**
   * false면 SomedayNews 전체(매니페스트 무관).
   * 기본 true = EODHD 매니페스트에서 EOD+5분 행이 있는 기사만(일봉만 있는 행은 제외).
   */
  requireEodOk?: boolean;
  /** true면 requireEodOk와 동일 집합(호환용 별칭). */
  requireIntradayOk?: boolean;
}): Promise<{
  items: SomedayNewsListItem[];
  total: number;
}> {
  const all = loadDeduped();
  const requireEod = options?.requireEodOk !== false;
  const requireIntra = options?.requireIntradayOk === true;
  const needManifest = requireIntra || requireEod;

  let filtered = all;
  if (needManifest) {
    const ids = await getArticleIdsWithIntradayManifestOk();
    filtered = all.filter((a) => ids.has(a.article_id));
  }

  const limit = options?.limit ?? filtered.length;
  return {
    items: filtered.slice(0, Math.max(0, limit)),
    total: filtered.length,
  };
}
