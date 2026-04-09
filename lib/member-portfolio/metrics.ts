import type { PortfolioQuoteSnap } from "./types";

/** 동일가중 평균 등락률 (시세 없는 종목 제외) */
export function averageChangePctEqualWeight(
  tickers: readonly string[],
  quotes: Readonly<Record<string, PortfolioQuoteSnap | null | undefined>>
): number | null {
  const pcts = tickers
    .map((t) => quotes[t]?.changePct)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (pcts.length === 0) return null;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}
