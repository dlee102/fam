/**
 * 대용량 fundamentals.json → 경량 model context JSON 생성 (Node/스크립트 공용).
 */

import type { FundamentalModelContextFile, FundamentalSnapshotForModel } from "./types";
import { buildSnapshotFromBundleRow } from "./extract-metrics";

type RawBundle = {
  generated_at?: string;
  tickers?: unknown[];
};

export function buildModelContextFromRawBundle(
  raw: unknown,
  sourceBundleRelPath: string | null
): FundamentalModelContextFile {
  const b = raw as RawBundle;
  const generated_at = new Date().toISOString();
  const bundleAt = typeof b.generated_at === "string" ? b.generated_at : null;
  const by_ticker: Record<string, FundamentalSnapshotForModel> = {};

  const rows = Array.isArray(b.tickers) ? b.tickers : [];
  for (const row of rows) {
    const snap = buildSnapshotFromBundleRow(row as never, bundleAt);
    if (!snap) continue;
    if (!(snap.ticker_key in by_ticker)) {
      by_ticker[snap.ticker_key] = snap;
    }
  }

  return {
    generated_at,
    source_bundle: sourceBundleRelPath,
    by_ticker,
  };
}
