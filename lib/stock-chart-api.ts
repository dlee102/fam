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
    let settled = false;
    const finish = (value: StockChartResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn("python3", ["scripts/stock_chart_data.py", date, tickerList], {
        cwd: projectRoot,
      });
    } catch (e) {
      console.error("[stock-chart-api] spawn threw:", e);
      resolve(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      console.error("[stock-chart-api] timeout after 12s");
      finish(null);
    }, 12_000);

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      console.error("[stock-chart-api] spawn error:", err);
      finish(null);
    });

    proc.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        console.error("[stock-chart-api] stderr:", stderr);
        finish(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          finish(null);
          return;
        }
        finish(parsed as StockChartResponse);
      } catch {
        finish(null);
      }
    });
  });
}
