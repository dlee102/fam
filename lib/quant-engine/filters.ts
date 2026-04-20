/**
 * 트렌드 필터 + 진입·손절 추천 — 바이오 소형주 특화 v2
 *
 * 근거:
 * - 섹션 5: MA20 필터 — 상승 추세 +0.758%, 하락 -0.537%
 * - 섹션 8: 사전 10일 모멘텀 하락 → +1.03% (역발상), 상승 → -1.36%
 * - 섹션 6: 최적 진입 = 익일 두 번째 5분봉 시가
 *
 * 바이오 소형주 보정:
 * - 보유 기간: 18→12일 (이벤트 반응이 빠르고 변동성이 커 장기 보유 불리)
 * - 손절: 1.5×ATR → 2.0×ATR (바이오 일상 변동이 커서 기존은 너무 타이트)
 * - 표시 상한: 35% → 45% (바이오 소형주 ATR이 크므로 상한 여유 필요)
 * - 모멘텀 기준: ±2% → ±4% (바이오 정상 모멘텀 범위가 넓음)
 */

import type { Indicators, OhlcBar, TrendFilter, EntryRecommendation, Grade } from "./types";

export function buildTrendFilter(ind: Indicators): TrendFilter {
  const { ma20, momentum10d } = ind;
  const close = ind.ma5; // 최근 종가 proxy

  const above_ma20 =
    close !== null && ma20 !== null ? close > ma20 : false;

  let momentum_direction: TrendFilter["momentum_direction"] = "FLAT";
  if (momentum10d !== null) {
    if (momentum10d < -4) momentum_direction = "FALLING";
    else if (momentum10d > 4) momentum_direction = "RISING";
  }

  // 최적 세팅: MA20 위에 있지만 단기는 눌린 상태 (역발상 진입)
  const contrarian_setup = above_ma20 && momentum_direction === "FALLING";

  let summary: string;
  if (contrarian_setup) {
    summary =
      "최근 20일 평균 주가보다는 위인데, 직전 약 10일 동안은 잠깐 내렸습니다.";
  } else if (above_ma20 && momentum_direction === "RISING") {
    summary =
      "평균보다 위에서 최근에도 오름세가 이어지고 있습니다. 이미 많이 올랐을 수 있어 무리한 추격은 주의하세요.";
  } else if (!above_ma20 && momentum_direction === "FALLING") {
    summary =
      "평균보다 아래이고 최근 흐름도 내려가는 편이라, 새로 들어가기엔 부담이 큽니다.";
  } else if (!above_ma20 && momentum_direction === "RISING") {
    summary =
      "평균보다 아래에 있지만 최근 흐름은 반등 쪽이라, 20일 평균가 부근·위로의 회복이 이어지는지가 관건입니다.";
  } else if (!above_ma20 && momentum_direction === "FLAT") {
    summary =
      "평균보다 아래인데 단기 방향은 뚜렷하지 않아, 평균가 대비 종가가 어디에 붙는지가 다음 구간의 승부처로 보입니다.";
  } else if (above_ma20) {
    summary = "최근 20일 평균 주가보다는 위에 있습니다. 큰 흐름만 보면 상대적으로 나은 편입니다.";
  } else {
    summary =
      "최근 20일 평균 주가보다는 아래에 있습니다. 평균가 회복 전까지는 변동 폭을 작게 잡는 편이 덜 부담스럽다고 볼 수 있습니다.";
  }

  return { above_ma20, momentum_direction, contrarian_setup, summary };
}

export function buildEntryRecommendation(
  ind: Indicators,
  grade: Grade,
  bars: OhlcBar[]
): EntryRecommendation {
  const timing_label = "익일 두 번째 5분봉 시가";

  // 바이오 소형주: 이벤트 반응이 빨라 보유 기간 단축
  // A/B: 12거래일, C: 8거래일, D: 비추
  const hold_trading_days =
    grade === "A" || grade === "B" ? 12
    : grade === "C" ? 8
    : 0;

  // 바이오 소형주 ATR 손절: 2.0×ATR (기존 1.5×는 일상 변동에 너무 빈번히 걸림)
  // 표시 상한 45% (바이오 ATR이 커서 35%로는 부족), 60% 초과 시 신뢰 불가
  let stop_loss_pct: number | null = null;
  if (ind.atr14 !== null && bars.length > 0) {
    const lastClose = bars[bars.length - 1].close;
    if (lastClose > 0) {
      const raw = (2.0 * ind.atr14) / lastClose * 100;
      if (Number.isFinite(raw) && raw > 0 && raw <= 60) {
        stop_loss_pct = parseFloat(Math.min(45, raw).toFixed(2));
      }
    }
  }

  return { timing_label, hold_trading_days, stop_loss_pct };
}
