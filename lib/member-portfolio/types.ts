export type PortfolioSyncState = "loading" | "local" | "cloud" | "cloud_error";

export type PortfolioQuoteSnap = {
  close: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  date: string;
  prevDate: string;
};

export type PortfolioQuotesResponse = {
  quotes?: Record<string, PortfolioQuoteSnap | null>;
};
