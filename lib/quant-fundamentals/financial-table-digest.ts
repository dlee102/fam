import type { StatementPeriodHighlight } from "./types";

/** Yahoo 손익계산서(annual/quarterly) JSON: 기간 → 계정과목 → 금액 */
type PeriodMap = Record<string, Record<string, unknown>>;

const REV_KEYS = ["Total Revenue", "Operating Revenue"];
const OP_KEYS = ["Operating Income", "Total Operating Income As Reported"];
const NET_KEYS = [
  "Net Income",
  "Net Income Common Stockholders",
  "Net Income From Continuing Operation Net Minority Interest",
];

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function parseTable(raw: unknown): PeriodMap | null {
  if (!raw || typeof raw !== "object" || "_error" in (raw as object)) return null;
  const o = raw as Record<string, unknown>;
  const periods = Object.keys(o).filter((k) => /^\d{4}-\d{2}-\d{2}/.test(k));
  if (!periods.length) return null;
  const out: PeriodMap = {};
  for (const p of periods) {
    const row = o[p];
    if (row && typeof row === "object" && !Array.isArray(row)) {
      out[p] = row as Record<string, unknown>;
    }
  }
  return Object.keys(out).length ? out : null;
}

function sortPeriodsDesc(periods: string[]): string[] {
  return [...periods].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/**
 * 연간 financials 우선, 없으면 분기 quarterly_financials에서 최근 구간만.
 */
export function digestStatementHighlights(tables: unknown): StatementPeriodHighlight[] {
  if (!tables || typeof tables !== "object") return [];
  const t = tables as Record<string, unknown>;

  const annual = parseTable(t.financials);
  if (annual) {
    const keys = sortPeriodsDesc(Object.keys(annual));
    return keys.slice(0, 3).map((period_end) => {
      const row = annual[period_end];
      return {
        period_end: period_end.slice(0, 10),
        total_revenue: pickNumber(row, REV_KEYS),
        operating_income: pickNumber(row, OP_KEYS),
        net_income: pickNumber(row, NET_KEYS),
      };
    });
  }

  const q = parseTable(t.quarterly_financials);
  if (q) {
    const keys = sortPeriodsDesc(Object.keys(q));
    return keys.slice(0, 4).map((period_end) => {
      const row = q[period_end];
      return {
        period_end: period_end.slice(0, 10),
        total_revenue: pickNumber(row, REV_KEYS),
        operating_income: pickNumber(row, OP_KEYS),
        net_income: pickNumber(row, NET_KEYS),
      };
    });
  }

  return [];
}
