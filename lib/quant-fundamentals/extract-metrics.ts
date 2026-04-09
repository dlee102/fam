import type { FundamentalDataQuality, FundamentalSnapshotForModel } from "./types";
import { digestStatementHighlights } from "./financial-table-digest";

/** Yahoo `info`에서 모델용으로 쓸 키 (순서 = 프롬프트 안정성) */
const INFO_KEYS_FOR_MODEL: string[] = [
  "longName",
  "shortName",
  "sector",
  "industry",
  "marketCap",
  "enterpriseValue",
  "trailingPE",
  "forwardPE",
  "pegRatio",
  "priceToBook",
  "priceToSalesTrailing12Months",
  "profitMargins",
  "operatingMargins",
  "grossMargins",
  "returnOnEquity",
  "returnOnAssets",
  "revenueGrowth",
  "earningsGrowth",
  "earningsQuarterlyGrowth",
  "revenuePerShare",
  "totalRevenue",
  "debtToEquity",
  "currentRatio",
  "quickRatio",
  "totalCash",
  "totalDebt",
  "beta",
  "fiftyTwoWeekHigh",
  "fiftyTwoWeekLow",
  "dividendYield",
  "payoutRatio",
  "exDividendDate",
  "bookValue",
  "sharesOutstanding",
];

function roundNum(n: number): number {
  if (!Number.isFinite(n)) return n;
  const a = Math.abs(n);
  if (a >= 1e12) return Math.round(n / 1e9) / 1e3;
  if (a >= 1e9) return Math.round(n / 1e6) / 1e3;
  if (a >= 1e6) return Math.round(n / 1e3) / 1e3;
  if (a >= 100) return Math.round(n * 100) / 100;
  return Math.round(n * 10000) / 10000;
}

function normalizeValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" && Number.isFinite(v)) return roundNum(v);
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "bigint") return Number(v);
  return String(v);
}

/** Yahoo가 종목 대신 펀드/오매칭일 때 `140410.KS,0P000…` 같은 쓰레기 문자열을 걸러냄 */
export function sanitizeYahooDisplayName(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (/\.(KS|KQ),0P/i.test(t)) return null;
  if (/\d{6}\.(KS|KQ)/i.test(t) && t.includes(",")) return null;
  return t;
}

export function extractMetricsFromYfInfo(
  info: Record<string, unknown> | null | undefined
): Record<string, string | number | null> {
  if (!info || typeof info !== "object") return {};
  const out: Record<string, string | number | null> = {};
  for (const key of INFO_KEYS_FOR_MODEL) {
    if (!(key in info)) continue;
    if (key === "longName" || key === "shortName") {
      const cleaned = sanitizeYahooDisplayName(
        typeof info[key] === "string" ? (info[key] as string) : null
      );
      if (cleaned) out[key] = cleaned;
      continue;
    }
    const n = normalizeValue(info[key]);
    if (n !== null && n !== "") out[key] = n;
  }
  return out;
}

function countNumericMetrics(m: Record<string, string | number | null>): number {
  return Object.values(m).filter((v) => typeof v === "number" && Number.isFinite(v)).length;
}

export function hasNonEmptyTables(tables: unknown): boolean {
  if (!tables || typeof tables !== "object") return false;
  const o = tables as Record<string, unknown>;
  for (const v of Object.values(o)) {
    if (v && typeof v === "object" && !("_error" in (v as object))) {
      const err = (v as { _error?: string })._error;
      if (!err) return true;
    }
  }
  return false;
}

type BundleTickerRow = {
  krx_code?: string;
  resolved_yahoo?: string | null;
  error?: string;
  data?: {
    yahoo_symbol?: string;
    info?: Record<string, unknown>;
    tables?: Record<string, unknown>;
  };
};

export function buildSnapshotFromBundleRow(
  row: BundleTickerRow,
  bundleGeneratedAt: string | null
): FundamentalSnapshotForModel | null {
  const rawKey = (row.krx_code ?? "").trim();
  if (!rawKey) return null;

  const ticker_key = /^\d+$/.test(rawKey) ? rawKey.padStart(6, "0") : rawKey.toUpperCase();

  if (row.error || !row.data) {
    return {
      source: "yfinance_bundle",
      ticker_key,
      yahoo_symbol: row.resolved_yahoo ?? null,
      company_name: null,
      sector: null,
      industry: null,
      bundle_generated_at: bundleGeneratedAt,
      data_quality: "missing",
      metrics: {},
      has_financial_tables: false,
    };
  }

  const info = row.data.info ?? {};
  const metrics = extractMetricsFromYfInfo(info);
  const longName = sanitizeYahooDisplayName(
    typeof info.longName === "string" ? info.longName : null
  );
  const shortName = sanitizeYahooDisplayName(
    typeof info.shortName === "string" ? info.shortName : null
  );
  const sector = typeof info.sector === "string" ? info.sector : null;
  const industry = typeof info.industry === "string" ? info.industry : null;

  const statement_highlights = digestStatementHighlights(row.data.tables);
  const hasStatement =
    statement_highlights.length > 0 &&
    statement_highlights.some(
      (h) =>
        (h.total_revenue !== null && h.total_revenue !== 0) ||
        (h.net_income !== null && h.net_income !== 0)
    );

  const numericCount = countNumericMetrics(metrics);
  let data_quality: FundamentalDataQuality = "ok";
  if (numericCount < 2) data_quality = "thin";
  if (numericCount === 0 && !longName && !shortName && !hasStatement) {
    data_quality = "missing";
  } else if (hasStatement && numericCount < 2) {
    data_quality = "ok";
  }

  return {
    source: "yfinance_bundle",
    ticker_key,
    yahoo_symbol: row.data.yahoo_symbol ?? row.resolved_yahoo ?? null,
    company_name: longName ?? shortName,
    sector,
    industry,
    bundle_generated_at: bundleGeneratedAt,
    data_quality,
    metrics,
    has_financial_tables: hasNonEmptyTables(row.data.tables),
    ...(statement_highlights.length ? { statement_highlights } : {}),
  };
}
