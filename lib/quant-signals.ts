/**
 * quant_signals.json 로드
 * 기사별 종목 퀀트 매매 신호
 */

import fs from "fs";
import path from "path";

export interface TickerSignal {
  signal: "추가 매수" | "관망" | "중립";
  strategy?: string;
}

let _cached: Record<string, Record<string, TickerSignal>> | null = null;

export function loadQuantSignals(): Record<string, Record<string, TickerSignal>> {
  if (_cached) return _cached;
  const filePath = path.join(process.cwd(), "data", "quant_signals.json");
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const signals = (data.signals ?? {}) as Record<string, Record<string, TickerSignal>>;
    _cached = signals;
    return signals;
  } catch {
    return {};
  }
}

/** 특정 기사의 종목별 신호 */
export function getQuantSignalsByNewsId(newsId: string): Record<string, TickerSignal> {
  const signals = loadQuantSignals();
  return signals[newsId] ?? {};
}
