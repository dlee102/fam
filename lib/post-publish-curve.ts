/**
 * 기사 발행 전후 누적 수익률 (5분봉 종가, T-3~T+4 장중).
 * 거래일 인덱스: 발행일(T0)=0, 발행 전(-1~-3), 발행 후(1~4).
 * T0는 published_at 이후에 끝난 봉만 포함(발행 전 봉은 전체 포함).
 * 수익률 0%: 발행 직후 T0 첫 5분봉 종가(앵커).
 */

import { loadEodBars, findManifestRow } from "@/lib/quant-engine/eod-loader";
import {
  fivemEndUtcMs,
  isMarketBar5m,
  kstSessionDateFromBarUtc,
  parsePublishUtcMs,
  type Raw5mBar,
} from "@/lib/quant-engine/intraday-5m-daily";
import { readEodhdJson } from "@/lib/eodhd-json-source";

export type PostPublishCurveKind = "five_min_close";

export interface PostPublishPoint {
  /** X축·툴팁용 (KST 짧은 표기) */
  label: string;
  /** 해당 봉의 KST 세션 날짜 YYYY-MM-DD */
  date: string;
  /** 5분봉 시작 시각(원본 문자열), 시계열 병합 키 */
  bar_datetime: string;
  cum_ret_pct: number;
}

export interface PostPublishSeries {
  ticker: string;
  curve: PostPublishCurveKind;
  t0_kst: string;
  published_at: string | null;
  anchor_date: string;
  anchor_price: number;
  anchor_label: string;
  points: PostPublishPoint[];
}

const PRE_DAYS = 3;   // 발행 전 포함 거래일 수 (T-3~T-1)
const POST_DAYS = 5;  // 발행 후 포함 거래일 수 (T0~T+4)

async function loadIntradayFile(
  article_id: string,
  ticker: string
): Promise<Raw5mBar[] | null> {
  const row = await findManifestRow(article_id, ticker);
  if (!row?.intraday_ok || !row.intraday_path) return null;
  const intraRel = row.intraday_path.startsWith("per_article/")
    ? row.intraday_path
    : `per_article/${row.intraday_path.replace(/^per_article\//, "")}`;
  const data = await readEodhdJson<{ bars?: Raw5mBar[] }>(intraRel);
  if (!data) return null;
  return data.bars ?? [];
}

/** KST 시·분만 (축 라벨: "0·09:15" 형태의 앞자리는 거래일 오프셋) */
function formatKstHm(dtStr: string): string {
  const ms = Date.parse(dtStr.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

export async function buildPostPublishSeries(
  articleId: string,
  ticker: string
): Promise<PostPublishSeries | null> {
  const loaded = await loadEodBars(articleId, ticker);
  if (!loaded?.t0_kst) return null;
  const { bars, t0_kst, published_at } = loaded;

  const i0 = bars.findIndex((b) => b.date >= t0_kst);
  if (i0 < 0) return null;

  // 발행 전(T-3~T-1) + 발행 후(T0~T+4) 거래일 목록
  const preSlice = bars.slice(Math.max(0, i0 - PRE_DAYS), i0);
  const postSlice = bars.slice(i0, i0 + POST_DAYS);
  if (postSlice.length === 0) return null;

  // dayIdx: 발행 전은 음수(-3,-2,-1), 발행 후는 0~4
  const sessionEntries: { date: string; dayIdx: number }[] = [
    ...preSlice.map((b, idx) => ({ date: b.date, dayIdx: idx - preSlice.length })),
    ...postSlice.map((b, idx) => ({ date: b.date, dayIdx: idx })),
  ];

  const raw = await loadIntradayFile(articleId, ticker);
  if (!raw?.length) return null;

  const pubMs = published_at ? parsePublishUtcMs(published_at) : null;
  const market = raw.filter(
    (b) => typeof b.datetime === "string" && isMarketBar5m(b.datetime)
  );

  const rawPoints: { dayIdx: number; date: string; bar: Raw5mBar; close: number }[] = [];

  for (const { date: d, dayIdx } of sessionEntries) {
    let dayBars = market.filter((b) => kstSessionDateFromBarUtc(b.datetime) === d);
    dayBars.sort((a, b) => a.datetime.localeCompare(b.datetime));

    // T0(발행일)는 발행 직후 봉만 포함
    if (dayIdx === 0 && pubMs !== null) {
      dayBars = dayBars.filter((b) => fivemEndUtcMs(b.datetime) > pubMs);
    }

    for (const b of dayBars) {
      const c = b.close;
      if (!Number.isFinite(c) || c <= 0) continue;
      rawPoints.push({ dayIdx, date: d, bar: b, close: c });
    }
  }

  if (rawPoints.length === 0) return null;

  // 앵커: T0의 첫 번째 봉 (없으면 전체 첫 봉)
  const anchorIdx = rawPoints.findIndex((p) => p.dayIdx === 0) ?? 0;
  if (anchorIdx < 0) return null;
  const p0 = rawPoints[anchorIdx]!.close;
  if (!Number.isFinite(p0) || p0 <= 0) return null;

  const points: PostPublishPoint[] = rawPoints.map(({ dayIdx, date, bar, close }, idx) => ({
    label: `${dayIdx}·${formatKstHm(bar.datetime)}`,
    date,
    bar_datetime: bar.datetime,
    cum_ret_pct: idx === anchorIdx ? 0 : ((close / p0) - 1) * 100,
  }));

  return {
    ticker,
    curve: "five_min_close",
    t0_kst,
    published_at,
    anchor_date: rawPoints[anchorIdx]!.date,
    anchor_price: p0,
    anchor_label: "발행 직후 첫 5분봉 종가 (0%)",
    points,
  };
}

export async function buildAllPostPublishSeries(
  articleId: string,
  ticker: string
): Promise<PostPublishSeries[]> {
  const s = await buildPostPublishSeries(articleId, ticker);
  return s ? [s] : [];
}
