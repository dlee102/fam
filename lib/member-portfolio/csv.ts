import type { PortfolioQuoteSnap } from "./types";

const CSV_COLS = ["종목코드", "종목명", "종가", "전일대비", "등락률%", "거래량", "기준일"] as const;

export function buildPortfolioCsvMatrix(
  tickers: readonly string[],
  tickerNames: Readonly<Record<string, string>>,
  quotes: Readonly<Record<string, PortfolioQuoteSnap | null | undefined>>
): string[][] {
  return [
    [...CSV_COLS],
    ...tickers.map((t) => {
      const q = quotes[t];
      const name = tickerNames[t] ?? "";
      return [
        t,
        name,
        q ? String(q.close) : "",
        q ? String(q.change) : "",
        q ? String(q.changePct) : "",
        q ? String(q.volume) : "",
        q?.date ?? "",
      ];
    }),
  ];
}

export function matrixToCsvString(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

export function downloadUtf8Csv(filenameBase: string, csvBody: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvBody], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
