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

const SIX_DIGIT_TICKER = /^\d{6}$/;

function normalizedSixDigitCodes(codes: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of codes) {
    const c = String(raw).trim();
    if (!SIX_DIGIT_TICKER.test(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** 피드·칩 등: 종목코드 나열을 종목명으로 표시 (매핑 없으면 코드 유지) */
export function formatTickerListForDisplay(codes: readonly string[]): string {
  return normalizedSixDigitCodes(codes)
    .map((c) => getTickerName(c))
    .join(", ");
}

/**
 * 문단·제목 등에서 6자리 종목코드를 종목명으로 치환.
 * codes에 포함된 코드만 바꿔서 날짜·금액 등 다른 6자리 숫자는 건드리지 않음.
 */
export function replaceTickerCodesWithNames(text: string, codes: readonly string[]): string {
  if (!text) return text;
  const unique = normalizedSixDigitCodes(codes);
  if (unique.length === 0) return text;
  let out = text;
  for (const code of unique) {
    const name = getTickerName(code);
    if (name === code) continue;
    const re = new RegExp(`(?<!\\d)${code}(?!\\d)`, "g");
    out = out.replace(re, name);
  }
  return out;
}
