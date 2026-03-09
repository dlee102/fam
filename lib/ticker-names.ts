/**
 * 종목코드 → 종목명 매핑
 * data/ticker_names.json (python3 scripts/fetch_ticker_names.py 로 생성)
 */

import fs from "fs";
import path from "path";

let _cache: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (_cache) return _cache;
  const p = path.join(process.cwd(), "data", "ticker_names.json");
  if (!fs.existsSync(p)) return {};
  try {
    _cache = JSON.parse(fs.readFileSync(p, "utf8"));
    return _cache ?? {};
  } catch {
    return {};
  }
}

export function getTickerName(ticker: string): string {
  const map = load();
  return map[ticker] ?? ticker;
}

/** 전체 매핑 (클라이언트에 전달용) */
export function getTickerNamesMap(): Record<string, string> {
  return load();
}
