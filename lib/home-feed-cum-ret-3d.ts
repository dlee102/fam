import { cumRet1dAnd3dFromPublish } from "@/lib/article-forward-cum-ret";
import { QUANT_V2_SCORE_DISPLAY_MAX } from "@/lib/quant-v2-score-cap";
import { getQuantV2ScoreForArticle } from "@/lib/quant-v2-prediction";
import { getTickersForArticle, hasRealIntradayData } from "@/lib/quant-engine";
import type { SomedayNewsListItem } from "@/lib/somedaynews-articles";

export type HomeFeedArticleRow = SomedayNewsListItem & {
  /** 발행 기준일(t0) 종가 → 1거래일 후 종가 누적 %, EOD 부족 시 null */
  cum_ret_1d_pct: number | null;
  /** 발행 기준일(t0) 종가 → 3거래일 후 종가 누적 %, EOD 부족 시 null */
  cum_ret_3d_pct: number | null;
  /** 수익률 산출에 사용한 매니페스트 첫 티커 */
  quote_ticker: string | null;
  /** 퀀트스코어(0~99): 번들 JSON 우선, 없으면 로지스틱 런타임 (없으면 null) */
  quant_score_total: number | null;
};

function publishedAtMs(iso: string): number {
  const t = Date.parse(iso.replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}

async function enrichOne(item: SomedayNewsListItem): Promise<HomeFeedArticleRow> {
  const tickers = await getTickersForArticle(item.article_id);
  const ticker = tickers[0];
  if (!ticker) {
    return {
      ...item,
      cum_ret_1d_pct: null,
      cum_ret_3d_pct: null,
      quote_ticker: null,
      quant_score_total: null,
    };
  }
  const real5m = await hasRealIntradayData(item.article_id, ticker);
  const quant_score_total = await getQuantV2ScoreForArticle(item.article_id, ticker);

  if (!real5m) {
    return {
      ...item,
      cum_ret_1d_pct: null,
      cum_ret_3d_pct: null,
      quote_ticker: ticker,
      quant_score_total,
    };
  }
  const { cum_ret_1d_pct, cum_ret_3d_pct } = await cumRet1dAnd3dFromPublish(
    item.article_id,
    ticker
  );
  return {
    ...item,
    cum_ret_1d_pct,
    cum_ret_3d_pct,
    quote_ticker: ticker,
    quant_score_total,
  };
}

/** 홈 피드 기사별 3거래일 누적 수익률 병렬 산출 */
export async function enrichHomeFeedWith3dCumRet(
  items: SomedayNewsListItem[],
  options?: { parallel?: number }
): Promise<HomeFeedArticleRow[]> {
  const parallel = Math.max(1, Math.min(24, options?.parallel ?? 12));
  const out: HomeFeedArticleRow[] = [];
  for (let i = 0; i < items.length; i += parallel) {
    const batch = items.slice(i, i + parallel);
    const rows = await Promise.all(batch.map(enrichOne));
    out.push(...rows);
  }
  return out;
}

/**
 * 산출된 3일 누적% 기준으로 목록을 상위 절반 / 하위 절반으로 나눔 (동률·최신순 보조 정렬 후 절반 컷).
 * 산출 불가 건은 `unknown`.
 */
export function splitHomeFeedBy3dReturnHalf(rows: HomeFeedArticleRow[]): {
  high: HomeFeedArticleRow[];
  low: HomeFeedArticleRow[];
  unknown: HomeFeedArticleRow[];
} {
  const withVal = rows.filter(
    (r): r is HomeFeedArticleRow & { cum_ret_3d_pct: number } =>
      r.cum_ret_3d_pct !== null && Number.isFinite(r.cum_ret_3d_pct)
  );
  if (withVal.length === 0) {
    return { high: [], low: [], unknown: [...rows].sort((a, b) => publishedAtMs(b.published_at) - publishedAtMs(a.published_at)) };
  }

  const sorted = [...withVal].sort(
    (a, b) =>
      b.cum_ret_3d_pct - a.cum_ret_3d_pct ||
      publishedAtMs(b.published_at) - publishedAtMs(a.published_at)
  );
  const half = Math.ceil(sorted.length / 2);
  const highIds = new Set(sorted.slice(0, half).map((r) => r.article_id));

  const byRetDesc = (
    a: HomeFeedArticleRow & { cum_ret_3d_pct: number },
    b: HomeFeedArticleRow & { cum_ret_3d_pct: number }
  ) =>
    b.cum_ret_3d_pct - a.cum_ret_3d_pct ||
    publishedAtMs(b.published_at) - publishedAtMs(a.published_at);

  const byPubDesc = (a: HomeFeedArticleRow, b: HomeFeedArticleRow) =>
    publishedAtMs(b.published_at) - publishedAtMs(a.published_at);

  const high = rows
    .filter(
      (r): r is HomeFeedArticleRow & { cum_ret_3d_pct: number } =>
        r.cum_ret_3d_pct !== null && Number.isFinite(r.cum_ret_3d_pct) && highIds.has(r.article_id)
    )
    .sort(byRetDesc);
  const low = rows
    .filter(
      (r): r is HomeFeedArticleRow & { cum_ret_3d_pct: number } =>
        r.cum_ret_3d_pct !== null && Number.isFinite(r.cum_ret_3d_pct) && !highIds.has(r.article_id)
    )
    .sort(byRetDesc);
  const unknown = rows.filter((r) => r.cum_ret_3d_pct === null).sort(byPubDesc);

  return { high, low, unknown };
}

/** 수익률 내림차순(동률이면 최신 기사). 산출 불가(null)는 맨 뒤(최신순). */
export function sortHomeFeedBy3dReturnDesc(rows: HomeFeedArticleRow[]): HomeFeedArticleRow[] {
  return [...rows].sort((a, b) => {
    const av = a.cum_ret_3d_pct;
    const bv = b.cum_ret_3d_pct;
    if (av == null && bv == null) return publishedAtMs(b.published_at) - publishedAtMs(a.published_at);
    if (av == null) return 1;
    if (bv == null) return -1;
    const d = bv - av;
    if (Math.abs(d) > 1e-12) return d;
    return publishedAtMs(b.published_at) - publishedAtMs(a.published_at);
  });
}

/**
 * 산출된 1일 누적% 기준으로 목록을 상위 절반 / 하위 절반으로 나눔 (동률 시 퀀트스코어·최신순 보조 정렬 후 절반 컷).
 * 각 절반 안 표시 순서는 1일 누적%·퀀트스코어를 동일 구간 내 min–max 정규화한 뒤 합이 큰 순.
 * 산출 불가 건은 `unknown`.
 */
export function splitHomeFeedBy1dReturnHalf(rows: HomeFeedArticleRow[]): {
  high: HomeFeedArticleRow[];
  low: HomeFeedArticleRow[];
  unknown: HomeFeedArticleRow[];
} {
  const withVal = rows.filter(
    (r): r is HomeFeedArticleRow & { cum_ret_1d_pct: number } =>
      r.cum_ret_1d_pct !== null && Number.isFinite(r.cum_ret_1d_pct)
  );
  if (withVal.length === 0) {
    return { high: [], low: [], unknown: [...rows].sort((a, b) => publishedAtMs(b.published_at) - publishedAtMs(a.published_at)) };
  }

  const sorted = [...withVal].sort(
    (a, b) =>
      b.cum_ret_1d_pct - a.cum_ret_1d_pct ||
      (b.quant_score_total ?? -Infinity) - (a.quant_score_total ?? -Infinity) ||
      publishedAtMs(b.published_at) - publishedAtMs(a.published_at)
  );
  const half = Math.ceil(sorted.length / 2);
  const highIds = new Set(sorted.slice(0, half).map((r) => r.article_id));

  const byPubDesc = (a: HomeFeedArticleRow, b: HomeFeedArticleRow) =>
    publishedAtMs(b.published_at) - publishedAtMs(a.published_at);

  const high = sortHomeFeedRowsBy1dReturnAndQuantCombo(
    rows.filter(
      (r): r is HomeFeedArticleRow & { cum_ret_1d_pct: number } =>
        r.cum_ret_1d_pct !== null && Number.isFinite(r.cum_ret_1d_pct) && highIds.has(r.article_id)
    )
  );
  const low = sortHomeFeedRowsBy1dReturnAndQuantCombo(
    rows.filter(
      (r): r is HomeFeedArticleRow & { cum_ret_1d_pct: number } =>
        r.cum_ret_1d_pct !== null && Number.isFinite(r.cum_ret_1d_pct) && !highIds.has(r.article_id)
    )
  );
  const unknown = rows.filter((r) => r.cum_ret_1d_pct === null).sort(byPubDesc);

  return { high, low, unknown };
}

/**
 * 동일 목록 안에서 1일 누적%·퀀트스코어를 함께 반영(각각 min–max 정규화 후 합, 동률 시 수익→퀀트스코어→최신).
 * 퀀트스코어 없음(null)은 해당 축 0으로 취급.
 */
function sortHomeFeedRowsBy1dReturnAndQuantCombo(
  rows: (HomeFeedArticleRow & { cum_ret_1d_pct: number })[]
): HomeFeedArticleRow[] {
  if (rows.length === 0) return [];
  const rets = rows.map((r) => r.cum_ret_1d_pct);
  const rMin = Math.min(...rets);
  const rMax = Math.max(...rets);
  const rSpan = rMax - rMin;
  const quants = rows
    .map((r) => r.quant_score_total)
    .filter((q): q is number => q != null && Number.isFinite(q));
  const qMin = quants.length ? Math.min(...quants) : 0;
  const qMax = quants.length ? Math.max(...quants) : QUANT_V2_SCORE_DISPLAY_MAX;
  const qSpan = qMax - qMin;

  const combo = (r: HomeFeedArticleRow & { cum_ret_1d_pct: number }): number => {
    const nr = rSpan > 1e-12 ? (r.cum_ret_1d_pct - rMin) / rSpan : 0.5;
    const q = r.quant_score_total;
    const nq =
      q != null && Number.isFinite(q)
        ? qSpan > 1e-12
          ? (q - qMin) / qSpan
          : 0.5
        : 0;
    return nr + nq;
  };

  return [...rows].sort((a, b) => {
    const dc = combo(b) - combo(a);
    if (Math.abs(dc) > 1e-12) return dc;
    const dr = b.cum_ret_1d_pct - a.cum_ret_1d_pct;
    if (Math.abs(dr) > 1e-12) return dr;
    const aq = a.quant_score_total ?? -Infinity;
    const bq = b.quant_score_total ?? -Infinity;
    const dq = bq - aq;
    if (Math.abs(dq) > 1e-12) return dq;
    return publishedAtMs(b.published_at) - publishedAtMs(a.published_at);
  });
}

/** 1일 누적%·퀀트스코어 복합 순(동일 배치 내 정규화 합). 산출 불가(null)는 맨 뒤(최신순). */
export function sortHomeFeedBy1dReturnDesc(rows: HomeFeedArticleRow[]): HomeFeedArticleRow[] {
  const withVal = rows.filter(
    (r): r is HomeFeedArticleRow & { cum_ret_1d_pct: number } =>
      r.cum_ret_1d_pct !== null && Number.isFinite(r.cum_ret_1d_pct)
  );
  const noVal = rows.filter((r) => r.cum_ret_1d_pct === null || !Number.isFinite(r.cum_ret_1d_pct));
  const sortedVal = sortHomeFeedRowsBy1dReturnAndQuantCombo(withVal);
  const sortedNoVal = [...noVal].sort(
    (a, b) => publishedAtMs(b.published_at) - publishedAtMs(a.published_at)
  );
  return [...sortedVal, ...sortedNoVal];
}
