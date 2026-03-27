import type { DailyOhlc } from "@/lib/stock-chart-api";

/**
 * Vercel 등 Python·ls_stock_1d CSV가 없을 때 ATR(14) 산출에 충분한 길이의 합성 일봉.
 * 티커·기준일 기반으로 결정적(deterministic)이라 요청마다 동일한 곡선.
 */
export function buildFallbackOhlc(centerYmd: string, ticker: string): DailyOhlc[] {
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed += ticker.charCodeAt(i);

  const y = parseInt(centerYmd.slice(0, 4), 10);
  const m = parseInt(centerYmd.slice(4, 6), 10) - 1;
  const d = parseInt(centerYmd.slice(6, 8), 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    return [];
  }

  const rows: DailyOhlc[] = [];
  let prevClose = 55_000 + (seed % 140) * 500;

  for (let day = -55; day <= 0 && rows.length < 28; day++) {
    const dt = new Date(y, m, d + day);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;

    const dateStr = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
    const w = rows.length;
    const open = Math.round(prevClose + Math.sin(seed + w * 0.9) * 600);
    const close = Math.round(open + Math.sin(seed * 0.02 + w * 0.5) * 1100);
    const high = Math.max(open, close) + Math.round(250 + (seed % 4) * 80);
    const low = Math.min(open, close) - Math.round(250 + (seed % 6) * 70);
    const volume = 600_000 + ((seed + w * 17) % 180) * 8000;
    rows.push({
      date: dateStr,
      open,
      high,
      low,
      close,
      volume,
    });
    prevClose = close;
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
