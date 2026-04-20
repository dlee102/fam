/**
 * per_article EOD bars 로더
 * data/eodhd_news_windows/per_article/manifest_per_article.json 기반
 * 로컬에 없으면 Firebase Realtime Database(FIREBASE_EODHD_RTD_ROOT)에서 조회
 */

import path from "path";
import type { OhlcBar } from "./types";
import { dailyOhlcFrom5mForInsight, type Raw5mBar } from "./intraday-5m-daily";
import { readEodhdJson } from "@/lib/eodhd-json-source";

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
  intraday_rows?: number;
}

/** 앱에서 사용하는 행: 일봉(EOD) + 5분봉 경로가 매니페스트상 완비된 경우만 */
function isManifestRowWithIntraday(r: ManifestRow): boolean {
  return Boolean(
    r.eod_ok &&
      r.article_id &&
      r.intraday_ok === true &&
      typeof r.intraday_path === "string" &&
      r.intraday_path.length > 0
  );
}

function publishedAtMs(iso: string): number {
  const t = Date.parse(iso.replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
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

let _manifestPromise: Promise<ManifestRow[]> | null = null;

async function loadManifest(): Promise<ManifestRow[]> {
  if (!_manifestPromise) {
    _manifestPromise = readEodhdJson<ManifestRow[]>(
      "per_article/manifest_per_article.json"
    ).then((rows) => (Array.isArray(rows) ? rows : []));
  }
  return _manifestPromise;
}

/**
 * 매니페스트 행이 *실제* 5분봉 데이터를 갖고 있는지 판별.
 * EODHD가 인트라데이를 지원하지 않는 종목은 일봉 간격 스텁만 반환하므로
 * `intraday_rows ≈ eod_rows` → false.
 */
function hasRealBars(r: ManifestRow): boolean {
  const ir = r.intraday_rows;
  const er = r.eod_rows;
  if (ir == null || er == null || er <= 0) return true;
  return ir > er * 2;
}

/**
 * article_id+ticker 조합에 대해 실제 5분봉 데이터가 존재하는지 확인.
 * 매니페스트 `intraday_rows / eod_rows` 비율로 판별하므로 파일 I/O 없음.
 */
export async function hasRealIntradayData(
  article_id: string,
  ticker: string
): Promise<boolean> {
  const manifest = await loadManifest();
  const row = manifest.find(
    (r) =>
      r.article_id === article_id &&
      r.ticker === ticker &&
      isManifestRowWithIntraday(r)
  );
  if (!row) return false;
  return hasRealBars(row);
}

/** 매니페스트에서 첫 번째 매칭 row 조회 (EOD+5분 매니페스트 완비 행만) */
export async function findManifestRow(
  article_id: string,
  ticker: string
): Promise<ManifestRow | null> {
  const manifest = await loadManifest();
  return (
    manifest.find(
      (r) =>
        r.article_id === article_id &&
        r.ticker === ticker &&
        isManifestRowWithIntraday(r)
    ) ?? null
  );
}

/** article_id 기준 ticker 목록 조회 (5분봉 연동 행만) */
export async function getTickersForArticle(
  article_id: string
): Promise<string[]> {
  const manifest = await loadManifest();
  const tickers = manifest
    .filter((r) => r.article_id === article_id && isManifestRowWithIntraday(r))
    .map((r) => r.ticker);
  return [...new Set(tickers)];
}

/**
 * 매니페스트에 EOD+5분 행이 하나라도 있는 article_id.
 * 일봉만 있는 기사는 앱 데이터 원천에서 제외한다.
 */
export async function getArticleIdsWithEodOk(): Promise<ReadonlySet<string>> {
  return getArticleIdsWithIntradayManifestOk();
}

/**
 * 매니페스트에 eod_ok + intraday_ok(5분 파일 경로) 행이 하나라도 있는 article_id.
 * `buildPostPublishSeries`·퀀트 인사이트·피드 필터에 공통 사용.
 */
export async function getArticleIdsWithIntradayManifestOk(): Promise<ReadonlySet<string>> {
  const manifest = await loadManifest();
  const ids = new Set<string>();
  for (const r of manifest) {
    if (isManifestRowWithIntraday(r)) ids.add(r.article_id);
  }
  return ids;
}

/**
 * EOD bars 로드
 * @returns 전체 bars (뉴스 발행 전 이력 포함) + 발행일(t0_kst)
 */
export async function loadEodBars(
  article_id: string,
  ticker: string
): Promise<{
  bars: OhlcBar[];
  t0_kst: string | null;
  published_at: string | null;
} | null> {
  const row = await findManifestRow(article_id, ticker);
  if (!row) return null;

  const rel = row.eod_path.startsWith("per_article/")
    ? row.eod_path
    : path.join("per_article", row.eod_path).replace(/\\/g, "/");

  const data = await readEodhdJson<EodFile>(rel);
  if (!data?.bars) return null;

  try {
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
 * 매니페스트에 등록된 해당 티커 EOD 중, 가장 최근 기사 행의 일봉 파일 말미 2봉으로
 * 전일 대비 등락을 계산 (실시간 시세 아님 · 데이터 없으면 null).
 */
export async function getLatestDailySnapshotForTicker(ticker: string): Promise<{
  close: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  date: string;
  prevDate: string;
} | null> {
  const manifest = await loadManifest();
  const rows = manifest.filter(
    (r) => r.ticker === ticker && isManifestRowWithIntraday(r)
  );
  if (!rows.length) return null;
  rows.sort((a, b) => publishedAtMs(b.published_at) - publishedAtMs(a.published_at));
  const row = rows[0]!;
  const loaded = await loadEodBars(row.article_id, ticker);
  if (!loaded?.bars.length) return null;
  const sorted = [...loaded.bars].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1]!;
  const prev = sorted[sorted.length - 2]!;
  const change = last.close - prev.close;
  const changePct = prev.close !== 0 ? (change / prev.close) * 100 : 0;
  return {
    close: last.close,
    prevClose: prev.close,
    change,
    changePct,
    volume: last.volume,
    date: last.date,
    prevDate: prev.date,
  };
}

/**
 * 분석용 bars: 발행일(t0) 캘린더 기준으로 포함 가능한 가장 최근 일봉까지.
 * `b.date <= t0_kst` — 발행일이 거래일이면 해당일 종가 봉 포함(일봉 해상도에서 발행 시각에 가장 가까운 값).
 */
export async function getBarsThroughPublishDate(
  article_id: string,
  ticker: string
): Promise<{ bars: OhlcBar[]; t0_kst: string | null } | null> {
  const result = await loadEodBars(article_id, ticker);
  if (!result) return null;
  const { bars, t0_kst } = result;
  if (!t0_kst) return result;

  const through = bars.filter((b) => b.date <= t0_kst);
  return { bars: through, t0_kst };
}

/** @deprecated Prefer {@link getBarsThroughPublishDate} (발행일 당일 봉 포함) */
export const getPreNewsBars = getBarsThroughPublishDate;

export type QuantInsightBarSource = "5m_agg";

/**
 * 퀀트 인사이트용 일봉 시계열: 5분봉만 사용(거래일별 집계, 발행일은 `published_at` 직전까지).
 * 매니페스트에 5분 경로가 없거나 파일·집계가 비면 null.
 */
export async function getBarsForQuantInsight(
  article_id: string,
  ticker: string
): Promise<{
  bars: OhlcBar[];
  t0_kst: string | null;
  published_at: string | null;
  bar_source: QuantInsightBarSource;
} | null> {
  const row = await findManifestRow(article_id, ticker);
  const eod = await loadEodBars(article_id, ticker);
  if (!row || !eod?.t0_kst) return null;

  const { t0_kst, published_at } = eod;
  const pub = published_at ?? row.published_at ?? "";
  if (!pub.length) return null;

  const fallbackMap = new Map(
    eod.bars.filter((b) => b.date <= t0_kst).map((b) => [b.date, b] as const)
  );

  const tradingDaysAsc = [...new Set(eod.bars.map((b) => b.date))]
    .filter((d) => d <= t0_kst)
    .sort();

  const intraRel = row.intraday_path!.startsWith("per_article/")
    ? row.intraday_path!
    : path.join("per_article", row.intraday_path!).replace(/\\/g, "/");

  const data = await readEodhdJson<{ bars?: Raw5mBar[]; published_at?: string }>(
    intraRel
  );

  if (!data?.bars?.length) return null;

  try {
    const rawBars = data.bars ?? [];
    const pubAt = data.published_at ?? pub;
    if (!pubAt) return null;

    const daily = dailyOhlcFrom5mForInsight(
      rawBars,
      tradingDaysAsc,
      t0_kst,
      pubAt,
      fallbackMap
    );

    if (daily.length === 0) return null;

    return {
      bars: daily,
      t0_kst,
      published_at: pubAt,
      bar_source: "5m_agg",
    };
  } catch {
    return null;
  }
}
