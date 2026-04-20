/**
 * `scripts/article_news_score.py` 의 extract_features_one + score_from_features 를 TypeScript로 이식.
 * JSON 배치에 없는 기사×티커도 동일 규칙으로 점수를 계산한다 (룩어헤드 없음).
 */
import path from "path";
import type { OhlcBar } from "@/lib/quant-engine/types";
import { findManifestRow, loadEodBars } from "@/lib/quant-engine/eod-loader";
import { readEodhdJson } from "@/lib/eodhd-json-source";
import {
  type Raw5mBar,
  isMarketBar5m,
  fivemEndUtcMs,
  parsePublishUtcMs,
  kstSessionDateFromBarUtc,
} from "@/lib/quant-engine/intraday-5m-daily";
import type { NewsSignalScorePayload } from "@/lib/news-signal-types";

interface IntradayFile {
  bars?: Raw5mBar[];
  published_at?: string;
}

function lin(x: number | null | undefined, xBad: number, xGood: number, wMax: number): number {
  if (x === undefined || x === null || !Number.isFinite(x)) return 0;
  if (xBad === xGood) return 0;
  const t = Math.max(0, Math.min(1, (x - xBad) / (xGood - xBad)));
  return Math.round(wMax * t * 100) / 100;
}

function scoreFromFeatures(f: {
  pub_hour: number | null;
  close_vs_ma20?: number | null;
  ret_1d_pre?: number | null;
  gap_open_pct?: number | null;
  entry_vs_prev_close?: number | null;
  entry_vs_prev_low?: number | null;
}): NewsSignalScorePayload {
  const ph = f.pub_hour;
  let sTime: number;
  if (ph !== null && ph !== undefined) {
    if (ph < 8) sTime = 15;
    else if (ph < 11) sTime = 10;
    else if (ph < 15) sTime = 5;
    else sTime = 0;
  } else {
    sTime = 0;
  }

  const cv = f.close_vs_ma20;
  const sMa = lin(cv, 0.05, -0.1, 20);

  const r1 = f.ret_1d_pre;
  const sR1 = lin(r1, 0.03, -0.08, 15);

  const gap = f.gap_open_pct;
  const sGap = lin(gap, 0.02, -0.05, 15);

  const evc = f.entry_vs_prev_close;
  const evl = f.entry_vs_prev_low;
  const sEvc = evc !== undefined && evc !== null ? lin(evc, 0.02, -0.12, 12.5) : 0;
  const sEvl = evl !== undefined && evl !== null ? lin(evl, 0, -0.1, 12.5) : 0;
  const sAnchor = Math.min(25, sEvc + sEvl);

  let bonus = 0;
  if (cv !== undefined && cv !== null && gap !== undefined && gap !== null && cv < 0 && gap < -0.02) {
    bonus += 5;
  }
  if (ph !== null && ph !== undefined && ph < 8 && cv !== undefined && cv !== null && cv < 0) {
    bonus += 3;
  }
  if (ph !== null && ph !== undefined && ph < 8 && r1 !== undefined && r1 !== null && r1 < -0.02) {
    bonus += 2;
  }
  bonus = Math.min(10, bonus);

  const total = Math.min(100, sTime + sMa + sR1 + sGap + sAnchor + bonus);

  return {
    score_total: Math.round(total * 100) / 100,
    breakdown: {
      time_max15: sTime,
      ma20_max20: sMa,
      ret1d_max15: sR1,
      gap_max15: sGap,
      anchor_max25: Math.round(sAnchor * 100) / 100,
      bonus_max10: bonus,
    },
    flags: {
      S1_pre_market: ph !== null && ph !== undefined && ph < 8,
      S2_ma20_neg_pre:
        ph !== null && ph !== undefined && ph < 8 && cv !== undefined && cv !== null && cv < 0,
      S4_ma20_gap:
        cv !== undefined &&
        cv !== null &&
        gap !== undefined &&
        gap !== null &&
        cv < 0 &&
        gap < -0.02,
      S5_pre_ret_neg:
        ph !== null && ph !== undefined && ph < 8 && r1 !== undefined && r1 !== null && r1 < -0.02,
      S6_below_prev_low: evl !== undefined && evl !== null && evl < -0.03,
      S7_deep_drop:
        evc !== undefined &&
        evc !== null &&
        evl !== undefined &&
        evl !== null &&
        evc < -0.07 &&
        evl < -0.03,
    },
  };
}

function groupByDate(bars: Raw5mBar[]): Map<string, Raw5mBar[]> {
  const d = new Map<string, Raw5mBar[]>();
  for (const b of bars) {
    const day = b.datetime.slice(0, 10);
    if (!d.has(day)) d.set(day, []);
    d.get(day)!.push(b);
  }
  return d;
}

function firstSessionKstDate(dayKey: string, byDay: Map<string, Raw5mBar[]>): string | null {
  const bars = (byDay.get(dayKey) ?? []).filter(
    (b) => typeof b.datetime === "string" && isMarketBar5m(b.datetime)
  );
  if (!bars.length) return null;
  bars.sort((a, b) => a.datetime.localeCompare(b.datetime));
  return kstSessionDateFromBarUtc(bars[0]!.datetime);
}

function firstCloseAfterPublishBarInfo(
  allIntra: Raw5mBar[],
  t0Ymd: string,
  publishMs: number
): { px: number; dk: string; anchorDatetime: string } | null {
  const market5m = allIntra.filter(
    (b) => typeof b.datetime === "string" && isMarketBar5m(b.datetime)
  );
  if (!market5m.length) return null;
  const byDay = groupByDate(market5m);
  const tradingDays = [...byDay.keys()].sort();
  let eventIdx: number | null = null;
  const t0 = t0Ymd.slice(0, 10);
  for (let i = 0; i < tradingDays.length; i++) {
    const dk = tradingDays[i]!;
    const sk = firstSessionKstDate(dk, byDay);
    if (sk !== null && sk >= t0) {
      eventIdx = i;
      break;
    }
  }
  if (eventIdx === null) return null;
  for (let j = eventIdx; j < tradingDays.length; j++) {
    const dk = tradingDays[j]!;
    const dayBars = [...(byDay.get(dk) ?? [])].sort((a, b) =>
      a.datetime.localeCompare(b.datetime)
    );
    for (const b of dayBars) {
      const dt = b.datetime;
      if (typeof dt !== "string" || !isMarketBar5m(dt)) continue;
      const endMs = fivemEndUtcMs(dt);
      if (endMs >= publishMs) {
        const v = Number(b.close ?? b.open ?? 0);
        if (v > 0) return { px: v, dk, anchorDatetime: dt };
      }
    }
  }
  return null;
}

function daySessionBars(allIntra: Raw5mBar[], ymd: string): Raw5mBar[] {
  return allIntra.filter(
    (b) =>
      typeof b.datetime === "string" &&
      b.datetime.slice(0, 10) === ymd &&
      isMarketBar5m(b.datetime)
  );
}

function firstIntradaySessionOpen(allIntra: Raw5mBar[], ymd: string): number | null {
  const day = daySessionBars(allIntra, ymd);
  if (!day.length) return null;
  day.sort((a, b) => a.datetime.localeCompare(b.datetime));
  const v = Number(day[0]!.open ?? day[0]!.close ?? 0);
  return v > 0 ? v : null;
}

/** UTC 일 단위 키가 아닌 **한국장 세션일(KST)** 로 당일 첫 시가 (갭용) */
function daySessionBarsKst(allIntra: Raw5mBar[], sessionKstYmd: string): Raw5mBar[] {
  const sk = sessionKstYmd.slice(0, 10);
  return allIntra.filter(
    (b) =>
      typeof b.datetime === "string" &&
      isMarketBar5m(b.datetime) &&
      kstSessionDateFromBarUtc(b.datetime) === sk
  );
}

function firstIntradaySessionOpenKst(allIntra: Raw5mBar[], sessionKstYmd: string): number | null {
  const day = daySessionBarsKst(allIntra, sessionKstYmd);
  if (!day.length) return null;
  day.sort((a, b) => a.datetime.localeCompare(b.datetime));
  const v = Number(day[0]!.open ?? day[0]!.close ?? 0);
  return v > 0 ? v : null;
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const d = new Date(ymd.slice(0, 10) + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** EOD `date`(KST 거래일) ↔ 5분봉 UTC 버킷 접두 불일치 대비 */
function resolveEodSessionIndex(
  eod: OhlcBar[],
  anchorDatetime: string,
  utcDayKey: string
): number | null {
  const sessionKst = kstSessionDateFromBarUtc(anchorDatetime).slice(0, 10);
  const utcP = utcDayKey.slice(0, 10);
  const candidates = [
    sessionKst,
    utcP,
    addCalendarDaysYmd(sessionKst, -1),
    addCalendarDaysYmd(sessionKst, 1),
    addCalendarDaysYmd(utcP, -1),
    addCalendarDaysYmd(utcP, 1),
  ];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    const idx = eodIndexForSessionYmd(eod, c);
    if (idx !== null) return idx;
  }
  return null;
}

function eodIndexOnOrAfter(bars: OhlcBar[], t0Ymd: string): number | null {
  const t0 = t0Ymd.slice(0, 10);
  for (let k = 0; k < bars.length; k++) {
    if (bars[k]!.date.slice(0, 10) >= t0) return k;
  }
  return null;
}

function eodIndexForSessionYmd(bars: OhlcBar[], ymd: string): number | null {
  const p = ymd.slice(0, 10);
  for (let k = 0; k < bars.length; k++) {
    if (bars[k]!.date.slice(0, 10) === p) return k;
  }
  return null;
}

/** `article_news_score.py` 의 pub_hour (KST 시각 0–23) */
function pubHourKst(publishedAt: string): number | null {
  const ms = parsePublishUtcMs(publishedAt);
  if (!Number.isFinite(ms)) return null;
  const hStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "hour")?.value;
  if (!hStr) return null;
  const n = parseInt(hStr, 10);
  return Number.isFinite(n) ? n : null;
}

/** Python `datetime.weekday()` 와 동일: 월=0 … 일=6 (KST 달력일) */
function pubWeekdayKstMon0(publishedAt: string): number | null {
  const ms = parsePublishUtcMs(publishedAt);
  if (!Number.isFinite(ms)) return null;
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "long",
  }).format(new Date(ms));
  const map: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };
  return map[wd] ?? null;
}

export type NewsSignalRawFeatures = {
  pub_hour: number | null;
  pub_weekday: number | null;
  entry_vs_prev_close: number;
  entry_vs_prev_low?: number;
  ret_1d_pre?: number;
  close_vs_ma20?: number;
  gap_open_pct?: number;
};

/**
 * 룩어헤드 없는 이벤트 피처 + EOD 인덱스 (Quant V2 로지스틱 등).
 * 실패 시 null.
 */
export async function extractNewsSignalFeatureRow(
  articleId: string,
  ticker: string
): Promise<{
  features: NewsSignalRawFeatures;
  publishedAt: string;
  i0: number;
  eod: OhlcBar[];
} | null> {
  if (!articleId?.trim() || !/^\d{6}$/.test(ticker)) return null;

  const row = await findManifestRow(articleId, ticker);
  if (!row) return null;

  const eodPack = await loadEodBars(articleId, ticker);
  if (!eodPack?.bars?.length) return null;

  const t0Str = eodPack.t0_kst ?? row.t0_kst;
  if (!t0Str?.trim()) return null;

  const intraRel = row.intraday_path!.startsWith("per_article/")
    ? row.intraday_path!
    : path.join("per_article", row.intraday_path!).replace(/\\/g, "/");

  const intraFile = await readEodhdJson<IntradayFile>(intraRel);
  const allIntra = intraFile?.bars ?? [];
  if (!allIntra.length) return null;

  const publishedAt = intraFile?.published_at ?? eodPack.published_at ?? row.published_at ?? "";
  if (!publishedAt.trim()) return null;

  const eod = [...eodPack.bars].sort((a, b) => a.date.localeCompare(b.date));
  const i0 = eodIndexOnOrAfter(eod, t0Str);
  if (i0 === null || i0 + 1 >= eod.length) return null;

  const publishMs = parsePublishUtcMs(publishedAt);
  if (!Number.isFinite(publishMs)) return null;

  const finfo = firstCloseAfterPublishBarInfo(allIntra, t0Str.slice(0, 10), publishMs);
  if (!finfo) return null;
  const pxF = finfo.px;
  const dkF = finfo.dk;

  const idxF = resolveEodSessionIndex(eod, finfo.anchorDatetime, dkF);
  if (idxF === null || pxF <= 0) return null;

  const cl = (i: number): number | null => {
    if (i < 0 || i >= eod.length) return null;
    const v = eod[i]!.close;
    return v !== undefined && v !== null && Number.isFinite(v) && v > 0 ? v : null;
  };
  const lo = (i: number): number | null => {
    if (i < 0 || i >= eod.length) return null;
    const v = eod[i]!.low;
    return v !== undefined && v !== null && Number.isFinite(v) && v > 0 ? v : null;
  };

  const cM1 = cl(i0 - 1);
  const cM2 = cl(i0 - 2);
  const lM1 = lo(i0 - 1);
  if (!cM1) return null;

  const ph = pubHourKst(publishedAt);
  const pwd = pubWeekdayKstMon0(publishedAt);

  const out: NewsSignalRawFeatures = {
    pub_hour: ph,
    pub_weekday: pwd,
    entry_vs_prev_close: pxF / cM1 - 1,
  };
  if (lM1 && lM1 > 0) {
    out.entry_vs_prev_low = pxF / lM1 - 1;
  }
  if (cM2 && cM2 > 0) {
    out.ret_1d_pre = cM1 / cM2 - 1;
  }
  if (i0 >= 20) {
    const s20: number[] = [];
    for (let k = 0; k < 20; k++) {
      const c = cl(i0 - 20 + k);
      if (!c || c <= 0) {
        break;
      }
      s20.push(c);
    }
    if (s20.length === 20) {
      out.close_vs_ma20 = cM1 / (s20.reduce((a, b) => a + b, 0) / 20) - 1;
    }
  }

  let prevClose: number | null = null;
  if (idxF > 0) {
    prevClose = cl(idxF - 1);
  }
  const sessionKstYmd = kstSessionDateFromBarUtc(finfo.anchorDatetime).slice(0, 10);
  const dayOpen =
    firstIntradaySessionOpenKst(allIntra, sessionKstYmd) ??
    firstIntradaySessionOpen(allIntra, dkF);
  if (prevClose && prevClose > 0 && dayOpen && dayOpen > 0) {
    out.gap_open_pct = dayOpen / prevClose - 1;
  }

  return { features: out, publishedAt, i0, eod };
}

/**
 * 매니페스트에 EOD+5분이 있고 피처 추출에 성공하면 점수 반환.
 */
export async function computeNewsSignalScore(
  articleId: string,
  ticker: string
): Promise<NewsSignalScorePayload | null> {
  const row = await extractNewsSignalFeatureRow(articleId, ticker);
  if (!row) return null;
  const { pub_weekday: _pw, ...forScore } = row.features;
  return scoreFromFeatures(forScore);
}
