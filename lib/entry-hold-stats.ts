/**
 * entry_hold_stats.json 로드
 * 입장 시점 & 보유 기간별 승률/수익률 통계
 */

import fs from "fs";
import path from "path";

export interface EntryHoldSummary {
  best_win_rate: {
    entry: string;
    entry_label: string;
    hold_days: number;
    win_rate: number;
    avg_return: number;
    count: number;
  };
  best_avg_return: {
    entry: string;
    entry_label: string;
    hold_days: number;
    win_rate: number;
    avg_return: number;
    count: number;
  };
}

let _cached: EntryHoldSummary | null = null;

export function loadEntryHoldSummary(): EntryHoldSummary | null {
  if (_cached) return _cached;
  const filePath = path.join(process.cwd(), "data", "entry_hold_stats.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    _cached = data.summary ?? null;
    return _cached;
  } catch {
    return null;
  }
}
