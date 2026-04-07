import type { HorizonEntrySeries } from "../lib/publish-horizon.types";

export const HORIZON_ENTRY_ORDER = ["A", "B", "C", "D", "E"] as const;

/** 차트·툴팁용: 말로 된 진입 정의 + 코드 */
export function horizonEntryLegendName(
  code: string,
  label: string | undefined
): string {
  const l = label?.trim();
  if (!l) return code;
  return `${l} (${code})`;
}

/** 카드 제목 등: 한 줄 요약 */
export function horizonEntryTitle(
  code: string,
  label: string | undefined,
  suffix: string
): string {
  const l = label?.trim();
  if (!l) return `${code} ${suffix}`;
  return `${l} — ${suffix}`;
}

export const HORIZON_ENTRY_COLORS: Record<string, string> = {
  A: "var(--color-accent)",
  B: "#f59e0b",
  C: "#6366f1",
  D: "#10b981",
  E: "#f43f5e",
};

export type HorizonChartRow = Record<string, number | null> & { day: number };

/** 선택된 진입만 합쳐 Recharts용 행 생성 */
export function buildHorizonChartRows(
  entries: Record<string, HorizonEntrySeries>,
  visible: Set<string>
): HorizonChartRow[] {
  const days = new Set<number>();
  for (const [k, v] of Object.entries(entries)) {
    if (!visible.has(k)) continue;
    v.points.forEach((p) => days.add(p.trading_day));
  }
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.map((day) => {
    const row = { day } as HorizonChartRow;
    for (const [k, v] of Object.entries(entries)) {
      if (!visible.has(k)) continue;
      const pt = v.points.find((p) => p.trading_day === day);
      row[k] = pt ? pt.avg_return_pct : null;
      row[`${k}_wr`] = pt ? Math.round(pt.win_rate * 1000) / 10 : null;
      row[`${k}_n`] = pt ? pt.count : null;
    }
    return row;
  });
}

export function bestPointByReturn(points: { trading_day: number; avg_return_pct: number; count: number }[]) {
  if (!points.length) return null;
  return points.reduce((a, b) => (b.avg_return_pct > a.avg_return_pct ? b : a));
}
