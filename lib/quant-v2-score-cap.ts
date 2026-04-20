/**
 * Quant V2 퀀트스코어·확률 표시: 100은 쓰지 않고 최대 99까지(반올림 후 클램프).
 */
export const QUANT_V2_SCORE_DISPLAY_MAX = 99;

export function clampQuantV2ScorePoints(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(QUANT_V2_SCORE_DISPLAY_MAX, Math.round(n)));
}
