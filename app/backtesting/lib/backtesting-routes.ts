/** 백테스팅 하위 탭 — href·라벨만 여기서 관리 */
export const BACKTESTING_SUBTABS = [
  { href: "/backtesting/manifest", label: "매니페스트 · 캐시" },
  { href: "/backtesting/stats", label: "기본 통계" },
] as const;

export type BacktestingSubtab = (typeof BACKTESTING_SUBTABS)[number];
