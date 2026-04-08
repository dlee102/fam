/**
 * 트렌드 필터 + 진입·손절 추천
 *
 * 근거:
 * - 섹션 5: MA20 필터 — 상승 추세 +0.758%, 하락 -0.537%
 * - 섹션 8: 사전 10일 모멘텀 하락 → +1.03% (역발상), 상승 → -1.36%
 * - 섹션 6: 최적 진입 = 익일 두 번째 5분봉 시가, 17-18거래일 보유
 * - 섹션 5: ATR 손절(1.5×) 도입 시 수익률 +0.645%로 개선
 */

import type { Indicators, OhlcBar, TrendFilter, EntryRecommendation, Grade } from "./types";

export function buildTrendFilter(ind: Indicators): TrendFilter {
  const { ma20, momentum10d } = ind;
  const close = ind.ma5; // 최근 종가 proxy

  const above_ma20 =
    close !== null && ma20 !== null ? close > ma20 : false;

  let momentum_direction: TrendFilter["momentum_direction"] = "FLAT";
  if (momentum10d !== null) {
    if (momentum10d < -2) momentum_direction = "FALLING";
    else if (momentum10d > 2) momentum_direction = "RISING";
  }

  // 최적 세팅: MA20 위에 있지만 단기는 눌린 상태 (역발상 진입)
  const contrarian_setup = above_ma20 && momentum_direction === "FALLING";

  let summary: string;
  if (contrarian_setup) {
    summary = "MA20 위 + 단기 하락 — 역발상 최적 세팅";
  } else if (above_ma20 && momentum_direction === "RISING") {
    summary = "MA20 위 + 상승 추세 — 재료 소멸 주의";
  } else if (!above_ma20 && momentum_direction === "FALLING") {
    summary = "MA20 아래 + 하락 — 진입 비권고";
  } else if (above_ma20) {
    summary = "MA20 위 — 시장 조건 양호";
  } else {
    summary = "MA20 아래 — 추가 확인 필요";
  }

  return { above_ma20, momentum_direction, contrarian_setup, summary };
}

export function buildEntryRecommendation(
  ind: Indicators,
  grade: Grade,
  bars: OhlcBar[]
): EntryRecommendation {
  // 보고서 섹션 6 최적 진입 (n≥500 기준 1위)
  const timing_label = "익일 두 번째 5분봉 시가";

  // 등급별 보유 일수 조정
  // A/B: 최적 18일, C: 14일 (n≥1200 기준), D: 추천하지 않음
  const hold_trading_days =
    grade === "A" || grade === "B" ? 18
    : grade === "C" ? 14
    : 0;

  // ATR 손절: 1.5×ATR / 종가 (%). ATR≥종가 꼴이면 100% 넘는 값이 나옴(데이터·극변동) → 50% 초과는 신뢰 불가로 미표시, 그 외는 표시 상한 35%
  let stop_loss_pct: number | null = null;
  if (ind.atr14 !== null && bars.length > 0) {
    const lastClose = bars[bars.length - 1].close;
    if (lastClose > 0) {
      const raw = (1.5 * ind.atr14) / lastClose * 100;
      if (Number.isFinite(raw) && raw > 0 && raw <= 50) {
        stop_loss_pct = parseFloat(Math.min(35, raw).toFixed(2));
      }
    }
  }

  return { timing_label, hold_trading_days, stop_loss_pct };
}
