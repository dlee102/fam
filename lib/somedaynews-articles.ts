/**
 * SomedayNews API로 적재된 뉴스 메타데이터
 * — 소스: Firebase RTDB만 (로컬 JSON 미사용)
 */

import { isFirebaseRtdbConfigured } from "@/lib/firebase/admin-app";
import { getSomedaynewsRtdbRoot } from "@/lib/firebase/rtdb-somedaynews";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";
import { getArticleIdsWithIntradayManifestOk } from "@/lib/quant-engine/eod-loader";
import {
  loadSomedaynewsArticleTickersRecords,
  type SomedayNewsArticleRecord,
} from "@/lib/somedaynews-json-source";

export type { SomedayNewsArticleRecord };

export interface SomedayNewsListItem {
  article_id: string;
  title: string;
  published_at: string;
  stock_codes: string[];
}

let _deduped: SomedayNewsListItem[] | null = null;
let _byArticleId: Map<string, SomedayNewsListItem> | null = null;
let _loadPromise: Promise<SomedayNewsListItem[]> | null = null;

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

async function loadDedupedAsync(): Promise<SomedayNewsListItem[]> {
  if (_deduped) return _deduped;
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const records = await loadSomedaynewsArticleTickersRecords();
      const list = dedupeAll(records);
      _deduped = list;
      _byArticleId = new Map(list.map((a) => [a.article_id, a]));
      return list;
    })();
  }
  return _loadPromise;
}

export async function getSomedayNewsByArticleId(articleId: string): Promise<SomedayNewsListItem | null> {
  if (!articleId) return null;
  await loadDedupedAsync();
  return _byArticleId?.get(articleId) ?? null;
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
  const all = await loadDedupedAsync();
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

/** `/` 홈 피드 원인 파악용 (로컬·터미널 디버그) */
export interface SomedayNewsFeedDebugSnapshot {
  /** SomedayNews 원천 */
  somedaySource: "firebase_rtdb" | "unconfigured";
  /** RTDB 노드 (Firebase일 때) */
  somedaynewsRtdbPath: string | null;
  /** 원본 레코드 수(중복 행 포함) */
  rawRecordCount: number;
  /** article_id 기준 dedupe 후 기사 수 */
  dedupedArticleCount: number;
  /** 매니페스트에 EOD+5분 연동된 article_id 개수 */
  manifestIntradayArticleIdCount: number;
  /** 매니페스트 필터 후(슬라이스 전) 건수 */
  afterFilterTotal: number;
  /** 화면에 실제 그리는 건수( limit 적용 후 ) */
  listedItemCount: number;
  listLimit: number;
  /** `getSomedayNewsList`와 동일: 매니페스트로 한 번 더 걸렀는지 */
  needManifestFilter: boolean;
  requireIntradayOk: boolean;
}

export async function getSomedayNewsFeedDebugSnapshot(options?: {
  limit?: number;
  requireEodOk?: boolean;
  requireIntradayOk?: boolean;
}): Promise<SomedayNewsFeedDebugSnapshot> {
  const listLimit = options?.limit ?? 150;
  const requireEod = options?.requireEodOk !== false;
  const requireIntra = options?.requireIntradayOk === true;
  const needManifest = requireIntra || requireEod;
  const useFirebase = isFirebaseRtdbConfigured();

  const records = await loadSomedaynewsArticleTickersRecords();
  const rawRecordCount = records.length;

  const all = await loadDedupedAsync();
  const dedupedArticleCount = all.length;

  const manifestIds = await getArticleIdsWithIntradayManifestOk();
  const manifestIntradayArticleIdCount = manifestIds.size;

  let filtered = all;
  if (needManifest) {
    filtered = all.filter((a) => manifestIds.has(a.article_id));
  }

  const afterFilterTotal = filtered.length;
  const listedItemCount = filtered.slice(0, Math.max(0, listLimit)).length;

  return {
    somedaySource: useFirebase ? "firebase_rtdb" : "unconfigured",
    somedaynewsRtdbPath: useFirebase
      ? `${getSomedaynewsRtdbRoot().replace(/^\/+|\/+$/g, "")}/somedaynews_article_tickers`
      : null,
    rawRecordCount,
    dedupedArticleCount,
    manifestIntradayArticleIdCount,
    afterFilterTotal,
    listedItemCount,
    listLimit,
    needManifestFilter: needManifest,
    requireIntradayOk: requireIntra,
  };
}
