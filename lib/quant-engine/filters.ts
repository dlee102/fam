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
    summary =
      "최근 20일 평균 주가보다는 위인데, 직전 약 10일 동안은 잠깐 내렸습니다.";
  } else if (above_ma20 && momentum_direction === "RISING") {
    summary =
      "평균보다 위에서 최근에도 오름세가 이어지고 있습니다. 이미 많이 올랐을 수 있어 무리한 추격은 주의하세요.";
  } else if (!above_ma20 && momentum_direction === "FALLING") {
    summary =
      "평균보다 아래이고 최근 흐름도 내려가는 편이라, 새로 들어가기엔 부담이 큽니다.";
  } else if (above_ma20) {
    summary = "최근 20일 평균 주가보다는 위에 있습니다. 큰 흐름만 보면 상대적으로 나은 편입니다.";
  } else {
    summary =
      "최근 20일 평균 주가보다는 아래에 있습니다. 아직 약한 편이라 뉴스·재무 등 다른 정보도 함께 보는 것이 좋습니다.";
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
