/**
 * 퀀트 엔진 공통 타입 — 바이오 소형주 특화 v2
 *
 * 가중치 근거 (redesign_quant_score.py N=1,080 + 바이오 소형주 보정):
 * - atr_ratio         : AUC 0.569. 바이오 소형은 ATR 6-10%가 정상 → 임계 상향.
 * - vol_ratio20       : AUC 0.418(역). 바이오는 카탈리스트 거래 급증이 잦아 스파이크 분리 필요.
 * - volume_spike_ratio: (신규) 5일 평균 대비 당일 거래량. 바이오 카탈리스트 탐지 핵심.
 * - ma5_20_spread     : AUC 0.529. 바이오 이격 정상 범위가 넓어 임계 상향.
 * - momentum10d       : AUC 0.525. 역발상 방향 유지, 가중치 상향.
 * - gap_pct           : (신규) 갭 오픈 %. 바이오는 장전 뉴스·공시로 갭이 크고 방향성 강.
 * - bb_pct_b          : AUC 0.526. WIN≈LOSS → 가중치 최소화.
 * - rsi14             : AUC 0.507. 사실상 노이즈 → 독립 가중치 삭제, 시그널에서만 참조.
 */

// ── 기초 데이터 ──────────────────────────────────────────────────────
export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── 지표 계산 결과 ────────────────────────────────────────────────────
export interface Indicators {
  /** 5일 단순이동평균 */
  ma5: number | null;
  /** 20일 단순이동평균 */
  ma20: number | null;
  /**
   * 단기-중기 이격도 (%) = (MA5 - MA20) / MA20 × 100
   * Bonferroni 통과 핵심 선행 변수.
   * 양수=단기 과열, 음수=단기 눌림.
   */
  ma5_20_spread: number | null;
  /** 14일 ATR */
  atr14: number | null;
  /**
   * ATR 비율 (%) = ATR14 / MA20 × 100
   * 낮을수록 변동성 응축 → 뉴스 반응 폭 유리.
   */
  atr_ratio: number | null;
  /** 볼린저 밴드 상단 (20일, 2σ) */
  bb_upper: number | null;
  /** 볼린저 밴드 중심 */
  bb_mid: number | null;
  /** 볼린저 밴드 하단 */
  bb_lower: number | null;
  /**
   * 밴드 폭 (%) = (Upper - Lower) / Mid × 100
   * 20% 이하 = 밴드 응축 (Squeeze 조건).
   */
  bb_width: number | null;
  /**
   * %B = (Close - Lower) / (Upper - Lower)
   * 0 = 하단, 0.5 = 중심, 1 = 상단.
   * 낮을수록 과매도·반등 여력.
   */
  bb_pct_b: number | null;
  /** RSI 14일 */
  rsi14: number | null;
  /**
   * 거래량 비율 = 당일 거래량 / 20일 평균 거래량
   * > 1.2 이상이면 거래량 실림.
   */
  vol_ratio20: number | null;
  /**
   * 10일 모멘텀 (%) = (Close / Close_10d_ago - 1) × 100
   * 음수 = 사전 하락 추세 → 역발상 효과 유리.
   */
  momentum10d: number | null;
  /**
   * 거래량 스파이크 비율 = 당일 거래량 / 5일 평균 거래량
   * 바이오 소형주에서 카탈리스트(FDA·임상·공시) 발생 시
   * 단기 거래량이 급증하는 패턴을 포착. > 3× 이면 유의미.
   */
  volume_spike_ratio: number | null;
  /**
   * 갭 오픈 (%) = (당일 시가 / 전일 종가 - 1) × 100
   * 양수 = 갭업, 음수 = 갭다운.
   * 바이오 소형주는 장전 뉴스로 ±5~20% 갭이 빈번하며 방향성이 강함.
   */
  gap_pct: number | null;
}

// ── 신호 ─────────────────────────────────────────────────────────────
/**
 * 백테스팅에서 검증된 4가지 시그널 유형:
 * - AGGRESSIVE_CONTRARIAN : RSI<35, 거래량 실림 → 평균 +1.55%, 승률 47% (표본 66건)
 * - VOLATILITY_SQUEEZE    : BB폭<20% → 평균 +1.03%, PF 1.56 (표본 841건, 가장 안정적)
 * - OVERSOLD_REBOUND      : %B<0.35, RSI<50 → +1.01%, 승률 45.8%
 * - MOMENTUM_WARNING      : 단기 과열 → 평균 -0.35% (회피 신호)
 * - DILUTION_RISK          : 바이오 소형주 유상증자·전환사채 행사 패턴 — 거래량↑+가격↓ 동시
 * - NEUTRAL               : 해당 없음
 */
export type SignalType =
  | "AGGRESSIVE_CONTRARIAN"
  | "VOLATILITY_SQUEEZE"
  | "OVERSOLD_REBOUND"
  | "MOMENTUM_WARNING"
  | "DILUTION_RISK"
  | "NEUTRAL";

export type Confidence = "HIGH" | "MED" | "LOW";

export interface SignalResult {
  type: SignalType;
  /** 화면 표시용 한글 레이블 */
  label: string;
  /** 시그널 강도 0-100 */
  strength: number;
  confidence: Confidence;
  /** 보고서 기반 기대 수익률 (%) */
  expected_return_pct: number | null;
  /** 보고서 기반 기대 PF */
  expected_pf: number | null;
  /** 조건 충족 항목 목록 */
  factors: string[];
}

// ── 트렌드 필터 ────────────────────────────────────────────────────────
export interface TrendFilter {
  /** 종가 > MA20 여부 (섹션 5: 상승 추세 +0.758%, 하락 -0.537%) */
  above_ma20: boolean;
  /** 사전 10일 모멘텀 방향 */
  momentum_direction: "FALLING" | "FLAT" | "RISING";
  /**
   * 역발상 세팅 여부 (섹션 8: 하락 추세에서 뉴스 → +1.03%)
   * above_ma20=true AND momentum_direction=FALLING → 최적 (MA20 위에 있지만 단기 눌림)
   */
  contrarian_setup: boolean;
  summary: string;
}

// ── 진입 추천 ─────────────────────────────────────────────────────────
export interface EntryRecommendation {
  /**
   * 최적 진입 시점 (그리드 서치 1위)
   * 익일 두 번째 5분봉 시가, 18거래일 보유 → 평균 +2.79%, PF 1.479
   */
  timing_label: string;
  hold_trading_days: number;
  /**
   * ATR 기반 손절 비율 (%) ≈ 1.5 × ATR14 / 종가 × 100 (표시 상한 35%; 50% 초과 시 null).
   */
  stop_loss_pct: number | null;
}

/** 기사 분류 톤 → 종합 표시 점수 가감용 (`classified` JSON의 label·confidence) */
export interface ArticleSentimentForScore {
  labelKo: string;
  confidence?: number;
}

// ── 복합 점수 ─────────────────────────────────────────────────────────
/** 가중 복합 점수 구성 요소 */
export interface ScoreBreakdown {
  /** atr_ratio 기여 (가중치 20) — 바이오 소형주는 기본 ATR이 높아 분별력 약화 */
  atr_score: number;
  /** vol_ratio20 기여 (가중치 18) — 거래량 과대 경고, 바이오 카탈리스트 구분 */
  vol_score: number;
  /** volume_spike_ratio 기여 (가중치 15) — 5일 대비 스파이크, 바이오 핵심 팩터 */
  vol_spike_score: number;
  /** ma5_20_spread 기여 (가중치 15) — 바이오 이격 정상 범위 넓음 반영 */
  spread_score: number;
  /** momentum10d 기여 (가중치 15) — 역발상, 가중치 상향 */
  momentum_score: number;
  /** gap_pct 기여 (가중치 10) — 장전 갭, 바이오 뉴스 반응 핵심 */
  gap_score: number;
  /** bb_pct_b 기여 (가중치 7) — 극단만 유효, 대폭 축소 */
  bb_score: number;
  /**
   * 가중 직후 0~100 (캘리브레이션 전). AUC≈0.53 수준의 약한 신호에 맞게
   * `total`은 이 값을 완화 매핑한 표시 점수.
   */
  raw_weighted: number;
  /** 기사 톤 반영 가감(정수). 캘리브 직후 값에 더한 뒤 `total` 클램프 */
  sentiment_nudge: number;
  /** 표시용 종합 점수 30–100 (바이오 소형주는 위험 구간을 드러내야 함, 최소 30) */
  total: number;
}

/**
 * 등급 — 표시 총점 `score.total` 구간 + 시그널 조합(과거 raw 73/53/34를 cal 기준으로 이식).
 * 극단 D만 `raw_weighted`로 고정.
 */
export type Grade = "A" | "B" | "C" | "D";

// ── 최종 결과 ─────────────────────────────────────────────────────────
export interface QuantInsight {
  ticker: string;
  /** 분석 기준일 (마지막 일봉의 거래일; 5m 집계면 발행 시각 직전까지 반영된 날) */
  as_of_date: string;
  /** GET /api/quant/insight: 5분봉→거래일 집계만 사용 */
  bar_source?: "5m_agg";
  indicators: Indicators;
  score: ScoreBreakdown;
  grade: Grade;
  /** 가장 강한 단일 시그널 */
  primary_signal: SignalResult;
  /** 전체 시그널 목록 (강도 내림차순) */
  all_signals: SignalResult[];
  trend_filter: TrendFilter;
  entry: EntryRecommendation;
  /** 한 줄 종합 코멘트 */
  summary: string;
}
