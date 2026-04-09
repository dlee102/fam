"use client";

import { useEffect, useMemo, useState } from "react";
import { PORTFOLIO_QUOTES_API } from "./constants";
import type { PortfolioQuoteSnap, PortfolioQuotesResponse } from "./types";

export type UsePortfolioQuotesResult = {
  quotes: Record<string, PortfolioQuoteSnap | null>;
  quotesLoading: boolean;
};

/**
 * 포트폴리오 시세 API. 티커 목록이 바뀌면 이전 요청은 abort.
 */
export function usePortfolioQuotes(tickers: readonly string[]): UsePortfolioQuotesResult {
  const [quotes, setQuotes] = useState<Record<string, PortfolioQuoteSnap | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const tickersKey = useMemo(() => tickers.join(","), [tickers]);

  useEffect(() => {
    if (!tickersKey) {
      setQuotes({});
      setQuotesLoading(false);
      return;
    }

    const ac = new AbortController();
    setQuotesLoading(true);

    fetch(`${PORTFOLIO_QUOTES_API}?tickers=${encodeURIComponent(tickersKey)}`, { signal: ac.signal })
      .then((res) => res.json() as Promise<PortfolioQuotesResponse>)
      .then((data) => {
        if (ac.signal.aborted) return;
        setQuotes(data.quotes ?? {});
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!ac.signal.aborted) setQuotes({});
      })
      .finally(() => {
        if (!ac.signal.aborted) setQuotesLoading(false);
      });

    return () => ac.abort();
  }, [tickersKey]);

  return { quotes, quotesLoading };
}
