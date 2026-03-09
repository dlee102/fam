/**
 * Ticker → ISIN mapping (한국 주식).
 * 필요시 확장.
 */
export const TICKER_TO_ISIN: Record<string, string> = {
  // 예: "005930": "KR7005930003",  // 삼성전자
  // 퀘이커케미칼, 인제비티 등 - 실제 ISIN 추가 필요
};

export function resolveSymbol(tickerOrIsin: string): string {
  return TICKER_TO_ISIN[tickerOrIsin] ?? tickerOrIsin;
}
