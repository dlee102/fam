/**
 * per_article EOD bars 로더
 * data/eodhd_news_windows/per_article/manifest_per_article.json 기반
 */

import fs from "fs";
import path from "path";
import type { OhlcBar } from "./types";
import { dailyOhlcFrom5mForInsight, type Raw5mBar } from "./intraday-5m-daily";

const BASE = path.join(process.cwd(), "data", "eodhd_news_windows");
const MANIFEST_PATH = path.join(BASE, "per_article", "manifest_per_article.json");

interface ManifestRow {
  article_idx: number;
  article_id: string;
  ticker: string;
  published_at: string;
  t0_kst: string;
  eod_ok: boolean;
  eod_path: string;
  eod_rows: number;
  intraday_ok?: boolean;
  intraday_path?: string;
}

interface EodFile {
  bars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    adjusted_close?: number;
    volume: number;
  }>;
  published_at?: string;
  t0_kst?: string;
}

let _manifest: ManifestRow[] | null = null;
let _articleIdsWithEodOk: Set<string> | null = null;

function loadManifest(): ManifestRow[] {
  if (_manifest) return _manifest;
  if (!fs.existsSync(MANIFEST_PATH)) {
    _manifest = [];
    return _manifest;
  }
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    _manifest = JSON.parse(raw) as ManifestRow[];
  } catch {
    _manifest = [];
  }
  return _manifest;
}

/** 매니페스트에서 첫 번째 매칭 row 조회 */
export function findManifestRow(
  article_id: string,
  ticker: string
): ManifestRow | null {
  const manifest = loadManifest();
  return (
    manifest.find(
      (r) => r.article_id === article_id && r.ticker === ticker && r.eod_ok
    ) ?? null
  );
}

/** article_id 기준 ticker 목록 조회 */
export function getTickersForArticle(article_id: string): string[] {
  const manifest = loadManifest();
  const tickers = manifest
    .filter((r) => r.article_id === article_id && r.eod_ok)
    .map((r) => r.ticker);
  return [...new Set(tickers)];
}

/** 매니페스트에 eod_ok 행이 하나라도 있는 article_id (피드 노출용) */
export function getArticleIdsWithEodOk(): ReadonlySet<string> {
  if (_articleIdsWithEodOk) return _articleIdsWithEodOk;
  const manifest = loadManifest();
  const ids = new Set<string>();
  for (const r of manifest) {
    if (r.eod_ok && r.article_id) ids.add(r.article_id);
  }
  _articleIdsWithEodOk = ids;
  return _articleIdsWithEodOk;
}

/**
 * EOD bars 로드
 * @returns 전체 bars (뉴스 발행 전 이력 포함) + 발행일(t0_kst)
 */
export function loadEodBars(
  article_id: string,
  ticker: string
): { bars: OhlcBar[]; t0_kst: string | null; published_at: string | null } | null {
  const row = findManifestRow(article_id, ticker);
  if (!row) return null;

  const eodPath = path.join(BASE, "per_article", row.eod_path.replace(/^per_article\//, ""));
  if (!fs.existsSync(eodPath)) return null;

  try {
    const raw = fs.readFileSync(eodPath, "utf8");
    const data = JSON.parse(raw) as EodFile;
    const bars: OhlcBar[] = (data.bars ?? []).map((b) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.adjusted_close ?? b.close,
      volume: b.volume,
    }));
    return {
      bars,
      t0_kst: data.t0_kst ?? row.t0_kst,
      published_at: data.published_at ?? row.published_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * 분석용 bars: 발행일(t0) 캘린더 기준으로 포함 가능한 가장 최근 일봉까지.
 * `b.date <= t0_kst` — 발행일이 거래일이면 해당일 종가 봉 포함(일봉 해상도에서 발행 시각에 가장 가까운 값).
 */
export function getBarsThroughPublishDate(
  article_id: string,
  ticker: string
): { bars: OhlcBar[]; t0_kst: string | null } | null {
  const result = loadEodBars(article_id, ticker);
  if (!result) return null;
  const { bars, t0_kst } = result;
  if (!t0_kst) return result;

  const through = bars.filter((b) => b.date <= t0_kst);
  return { bars: through, t0_kst };
}

/** @deprecated Prefer {@link getBarsThroughPublishDate} (발행일 당일 봉 포함) */
export const getPreNewsBars = getBarsThroughPublishDate;

export type QuantInsightBarSource = "5m_agg" | "eod_daily";

/**
 * 퀀트 인사이트용 일봉 시계열.
 * - 매니페스트에 5분봉이 있으면: 장중 5분봉을 거래일별로 집계하고, 발행일은 `published_at` 직전까지의 봉만 반영.
 * - 없으면: EOD 일봉 파일(`getBarsThroughPublishDate`) 사용.
 */
export function getBarsForQuantInsight(
  article_id: string,
  ticker: string
): {
  bars: OhlcBar[];
  t0_kst: string | null;
  published_at: string | null;
  bar_source: QuantInsightBarSource;
} | null {
  const row = findManifestRow(article_id, ticker);
  const eod = loadEodBars(article_id, ticker);
  if (!eod?.t0_kst) return null;

  const { t0_kst, published_at } = eod;
  const pub = published_at ?? row?.published_at ?? "";
  const throughEod = getBarsThroughPublishDate(article_id, ticker);
  if (!throughEod) return null;

  const fallbackMap = new Map(
    eod.bars.filter((b) => b.date <= t0_kst).map((b) => [b.date, b] as const)
  );

  const tradingDaysAsc = [...new Set(eod.bars.map((b) => b.date))]
    .filter((d) => d <= t0_kst)
    .sort();

  const useIntra =
    row?.intraday_ok &&
    row.intraday_path &&
    pub.length > 0;

  if (!useIntra) {
    return {
      bars: throughEod.bars,
      t0_kst,
      published_at: published_at ?? row?.published_at ?? null,
      bar_source: "eod_daily",
    };
  }

  const intraRel = row!.intraday_path!.replace(/^per_article\//, "");
  const intraPath = path.join(BASE, "per_article", intraRel);
  if (!fs.existsSync(intraPath)) {
    return {
      bars: throughEod.bars,
      t0_kst,
      published_at: published_at ?? row?.published_at ?? null,
      bar_source: "eod_daily",
    };
  }

  try {
    const raw = fs.readFileSync(intraPath, "utf8");
    const data = JSON.parse(raw) as { bars?: Raw5mBar[]; published_at?: string };
    const rawBars = data.bars ?? [];
    const pubAt = data.published_at ?? pub;
    if (!pubAt) {
      return {
        bars: throughEod.bars,
        t0_kst,
        published_at: published_at ?? null,
        bar_source: "eod_daily",
      };
    }

    const daily = dailyOhlcFrom5mForInsight(
      rawBars,
      tradingDaysAsc,
      t0_kst,
      pubAt,
      fallbackMap
    );

    if (daily.length === 0) {
      return {
        bars: throughEod.bars,
        t0_kst,
        published_at: published_at ?? row?.published_at ?? null,
        bar_source: "eod_daily",
      };
    }

    return {
      bars: daily,
      t0_kst,
      published_at: pubAt,
      bar_source: "5m_agg",
    };
  } catch {
    return {
      bars: throughEod.bars,
      t0_kst,
      published_at: published_at ?? row?.published_at ?? null,
      bar_source: "eod_daily",
    };
  }
}
