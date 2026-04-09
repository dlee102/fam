/**
 * yfinance 번들에서 KRX 6자리 → marketCap(원) 인덱스 (서버에서 1회 파싱 후 캐시).
 */

import fs from "fs";
import path from "path";

function normalizeKrx(code: string): string {
  const s = String(code).replace(/\D/g, "");
  if (!s) return "";
  return s.length <= 6 ? s.padStart(6, "0") : s;
}

function findLatestFundamentalsJson(): string | null {
  const root = path.join(process.cwd(), "data", "yfinance_fundamentals");
  if (!fs.existsSync(root)) return null;
  const paths: string[] = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const p = path.join(root, ent.name, "fundamentals.json");
    if (fs.existsSync(p)) paths.push(p);
  }
  if (!paths.length) return null;
  paths.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return paths[0] ?? null;
}

interface BundleRoot {
  tickers?: {
    krx_code?: string;
    data?: { info?: Record<string, unknown> };
  }[];
}

let cached: Map<string, number> | null | undefined;

function loadMap(): Map<string, number> | null {
  if (cached !== undefined) return cached;
  const explicit = process.env.YFINANCE_FUNDAMENTALS_JSON?.trim();
  const p = explicit || findLatestFundamentalsJson();
  if (!p || !fs.existsSync(p)) {
    cached = null;
    return cached;
  }
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8")) as BundleRoot;
    const map = new Map<string, number>();
    for (const t of j.tickers ?? []) {
      const code = normalizeKrx(t.krx_code ?? "");
      if (!/^\d{6}$/.test(code)) continue;
      const raw = t.data?.info?.marketCap;
      const n = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
      if (n !== null) map.set(code, n);
    }
    cached = map;
    return cached;
  } catch {
    cached = null;
    return cached;
  }
}

export function getKrxMarketCap(code: string): number | null {
  const c = normalizeKrx(code);
  if (!c) return null;
  return loadMap()?.get(c) ?? null;
}

/** 동종 순위 계산용: 맵 전체 (없으면 null) */
export function getKrxMarketCapMap(): Map<string, number> | null {
  return loadMap();
}
