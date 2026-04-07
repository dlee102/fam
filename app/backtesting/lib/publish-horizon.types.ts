/** `data/publish_horizon_curve.json` 스키마 + 클라이언트에서도 쓰는 순수 함수 */

export type HorizonPoint = {
  trading_day: number;
  avg_return_pct: number;
  win_rate: number;
  count: number;
  /** 승 관측 수 — 스크립트 재실행 후 생성 */
  n_pos?: number;
  /** 승 관측 평균 수익률(%) */
  avg_pos_return_pct?: number;
  /** 패 관측 수 */
  n_neg?: number;
  /** 패 관측 평균 수익률(%, 음수) */
  avg_neg_return_pct?: number;
};

export type TickerAttrRow = {
  ticker: string;
  count: number;
  avg_return_pct: number;
  win_rate: number;
  avg_pos_return_pct: number;
  avg_neg_return_pct: number;
  n_pos: number;
  n_neg: number;
};

export type HorizonEntrySeries = {
  label: string;
  points: HorizonPoint[];
};

export type HorizonEntrySampleStats = {
  label: string;
  n_at_1_trading_day: number;
  min_n_any_horizon: number;
  longest_horizon_trading_days: number;
  n_at_longest_horizon: number;
};

export type HorizonSampleSummary = {
  unit_note?: string;
  pairs_passed_t0_t1_calendar?: number;
  pairs_with_at_least_one_observation?: number;
  by_entry?: Record<string, HorizonEntrySampleStats>;
};

export type PublishHorizonFile = {
  generated_at?: string;
  definition?: string;
  sample_summary?: HorizonSampleSummary;
  entries?: Record<string, HorizonEntrySeries>;
  /** entry → hold_day(문자열) → 종목별 귀속 rows (avg_return_pct 오름차순) */
  ticker_attribution?: Record<string, Record<string, TickerAttrRow[]>>;
};

export function hasPublishHorizonData(data: PublishHorizonFile | null): boolean {
  if (!data?.entries) return false;
  return Object.values(data.entries).some((e) => e.points.length > 0);
}

function deriveByEntryFromPoints(
  entries: Record<string, HorizonEntrySeries> | undefined
): Record<string, HorizonEntrySampleStats> {
  const by_entry: Record<string, HorizonEntrySampleStats> = {};
  if (!entries) return by_entry;
  for (const [k, v] of Object.entries(entries)) {
    const pts = [...v.points].sort((a, b) => a.trading_day - b.trading_day);
    if (!pts.length) continue;
    const p1 = pts.find((p) => p.trading_day === 1);
    const maxH = Math.max(...pts.map((p) => p.trading_day));
    const pLast = pts.find((p) => p.trading_day === maxH);
    const minN = Math.min(...pts.map((p) => p.count));
    by_entry[k] = {
      label: v.label,
      n_at_1_trading_day: p1?.count ?? 0,
      min_n_any_horizon: minN,
      longest_horizon_trading_days: maxH,
      n_at_longest_horizon: pLast?.count ?? 0,
    };
  }
  return by_entry;
}

export function resolveSampleSummary(data: PublishHorizonFile): HorizonSampleSummary {
  const s = data.sample_summary;
  const fromPoints = deriveByEntryFromPoints(data.entries);
  const by_entry =
    s?.by_entry && Object.keys(s.by_entry).length > 0 ? s.by_entry : fromPoints;
  return {
    unit_note: s?.unit_note ?? "집계 단위: 기사 1건 × 종목 1코드 = 표본 1개.",
    pairs_passed_t0_t1_calendar: s?.pairs_passed_t0_t1_calendar,
    pairs_with_at_least_one_observation: s?.pairs_with_at_least_one_observation,
    by_entry,
  };
}
