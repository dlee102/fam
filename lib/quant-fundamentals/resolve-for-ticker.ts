import type { FundamentalModelContextFile, FundamentalSnapshotForModel } from "./types";

export function normalizeTickerLookupKey(ticker: string): string {
  const t = ticker.trim();
  if (!t) return "";
  if (/^\d{1,6}$/.test(t)) return t.padStart(6, "0");
  if (/^[A-Za-z]/.test(t)) return t.replace(/\s+/g, "").toUpperCase();
  return t;
}

export function pickSnapshotForTicker(
  file: FundamentalModelContextFile | null,
  ticker: string
): FundamentalSnapshotForModel | null {
  if (!file?.by_ticker || !ticker) return null;
  const key = normalizeTickerLookupKey(ticker);
  if (!key) return null;
  return file.by_ticker[key] ?? null;
}
