/**
 * EODHD 한국장 5분봉 → 일봉 집계 (scripts/analyze_10m_return_path.py · entry_hold_analysis.py 와 동일 규칙)
 * - 장중 봉: UTC 시각 `HH:MM` 이 00:00~06:25
 * - 봉 종료 시각 = 시작(UTC) + 5분
 * - published_at 은 UTC로 환산해 봉 종료 시각과 비교
 */

import type { OhlcBar } from "./types";

export interface Raw5mBar {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** UTC naive 시각 문자열의 분 단위 키 */
function hmUtc(dtStr: string): string {
  return dtStr.length >= 16 ? dtStr.slice(11, 16) : "";
}

/** EODHD 한국장 5분봉(UTC 버킷) */
export function isMarketBar5m(dtStr: string): boolean {
  const hm = hmUtc(dtStr);
  return hm >= "00:00" && hm <= "06:25";
}

function barStartUtcMs(dtStr: string): number {
  return Date.parse(dtStr.replace(" ", "T") + "Z");
}

export function fivemEndUtcMs(dtStr: string): number {
  return barStartUtcMs(dtStr) + 5 * 60 * 1000;
}

/** Python parse_publish_utc_naive 와 동일 */
export function parsePublishUtcMs(published_at: string): number {
  const s = published_at.trim().replace("Z", "+00:00");
  if (/[+-]\d{2}:?\d{2}$/.test(s) || s.endsWith("Z")) {
    return Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  }
  return Date.parse(s.replace(" ", "T") + "+09:00");
}

/** 5분봉 시점의 한국장 세션 날짜 (YYYY-MM-DD, KST) */
export function kstSessionDateFromBarUtc(dtStr: string): string {
  const ms = barStartUtcMs(dtStr);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function aggregateSessionBars(rows: Raw5mBar[], date: string): OhlcBar | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.datetime.localeCompare(b.datetime));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  let high = -Infinity;
  let low = Infinity;
  let vol = 0;
  for (const b of sorted) {
    high = Math.max(high, b.high, b.open, b.close);
    low = Math.min(low, b.low, b.open, b.close);
    vol += b.volume ?? 0;
  }
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return {
    date,
    open: first.open,
    high,
    low,
    close: last.close,
    volume: vol,
  };
}

/**
 * EOD 일봉의 거래일 순서 + 5분봉으로 일봉 시계열 생성.
 * - 각 거래일 `d < t0_kst`: 해당 KST 세션 전체 5분봉 집계
 * - `d === t0_kst`: `published_at` 이전에 **종료**된 장중 봉만 포함 (가장 가까운 스냅샷)
 * - 장 시작 전 공개면 해당일 봉은 생략(직전 완료 거래일까지)
 * - 특정일 5분봉이 없으면 해당일은 eodFallbackBar 로 대체(선택)
 */
export function dailyOhlcFrom5mForInsight(
  raw: Raw5mBar[],
  tradingDaysAsc: string[],
  t0_kst: string,
  published_at: string,
  eodFallbackByDate: Map<string, OhlcBar>
): OhlcBar[] {
  const pubMs = parsePublishUtcMs(published_at);
  const market = raw.filter(
    (b) => typeof b.datetime === "string" && isMarketBar5m(b.datetime)
  );
  const out: OhlcBar[] = [];

  for (const d of tradingDaysAsc) {
    if (d > t0_kst) break;

    const dayBars = market.filter((b) => kstSessionDateFromBarUtc(b.datetime) === d);

    if (d < t0_kst) {
      let bar = aggregateSessionBars(dayBars, d);
      if (!bar) {
        const fb = eodFallbackByDate.get(d);
        if (fb) bar = fb;
      }
      if (bar) out.push(bar);
      continue;
    }

    // d === t0_kst — 직전에 종료된 5분봉까지만(공개 시각 이후 봉 제외). 장 시작 전 공개면 당일 봉 없음.
    const cutoff = dayBars.filter((b) => fivemEndUtcMs(b.datetime) <= pubMs);
    const bar = aggregateSessionBars(cutoff, d);
    if (bar) out.push(bar);
  }

  return out;
}
