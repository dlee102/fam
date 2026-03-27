/** 키움 로보마켓 데모 가격·구간 (단일 소스) */
export const ROBO_DEMO = {
  price: {
    last: 1_010_000,
    buyLow: 985_000,
    buyHigh: 1_005_000,
    tp1Low: 1_035_000,
    tp1High: 1_055_000,
    tp2Low: 1_080_000,
    tp2High: 1_120_000,
  },
} as const;

export function roboScale(price: typeof ROBO_DEMO.price) {
  const p = price;
  const scaleMin = Math.min(p.buyLow, p.tp1Low) - 25_000;
  const scaleMax = p.tp2High + 25_000;
  const span = scaleMax - scaleMin;
  return { scaleMin, scaleMax, span };
}
