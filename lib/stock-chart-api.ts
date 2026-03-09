/**
 * ls_stock_1min 기반 주가 차트 데이터 조회
 */

import { spawn } from "child_process";
import path from "path";

export interface DailyOhlc {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerReturns {
  "1d": number | null;
  "2d": number | null;
  "3d": number | null;
  "10d": number | null;
}

export interface StockChartResponse {
  center_date: string;
  data: Record<string, DailyOhlc[]>;
  returns?: Record<string, TickerReturns>;
}

export async function getStockChartData(
  date: string,
  tickers: string[]
): Promise<StockChartResponse | null> {
  if (tickers.length === 0) return null;

  const projectRoot = path.resolve(process.cwd());
  const tickerList = tickers.join(",");

  return new Promise((resolve) => {
    const proc = spawn(
      "python3",
      ["scripts/stock_chart_data.py", date, tickerList],
      { cwd: projectRoot }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("[stock-chart-api] stderr:", stderr);
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          resolve(null);
          return;
        }
        resolve(parsed as StockChartResponse);
      } catch {
        resolve(null);
      }
    });
  });
}
