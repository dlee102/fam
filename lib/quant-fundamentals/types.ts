/**
 * 퀀트 AI 인사이트용 펀더멘탈 스냅샷 (Yahoo Finance / yfinance 수집본 기반).
 * 재무제표 전체가 아니라 모델에 넘기기 좋은 축약 필드만 둔다.
 */

export type FundamentalDataQuality = "ok" | "thin" | "missing";

/** Yahoo annual/quarterly 손익에서 뽑은 최근 구간 요약(원화) */
export type StatementPeriodHighlight = {
  period_end: string;
  total_revenue: number | null;
  operating_income: number | null;
  net_income: number | null;
};

export type FundamentalSnapshotForModel = {
  source: "yfinance_bundle";
  /** news_tickers / 퀀트 엔진과 동일한 식별자 (6자리 또는 해외 티커) */
  ticker_key: string;
  yahoo_symbol: string | null;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  /** 스냅샷 시각(번들 메타) */
  bundle_generated_at: string | null;
  data_quality: FundamentalDataQuality;
  /** 재무표 원본은 넣지 않고, info에서 뽑은 수치·비율만 */
  metrics: Record<string, string | number | null>;
  /** 분기 재무 데이터가 번들에 존재하는지 */
  has_financial_tables: boolean;
  /** info가 빈 종목용: 연·분기 손익 요약 */
  statement_highlights?: StatementPeriodHighlight[];
};

/** 바이오 소형주 관점 펀더멘탈 서브스코어 (기술 총점과 독립) */
export type FundamentalScoreBreakdown = {
  /** 영업이익 방향·흑자여부 (가중치 30%) */
  profit_direction_score: number | null;
  /** 매출 성장 (가중치 20%) */
  revenue_growth_score: number | null;
  /** 재무 건전성 — currentRatio·현금·부채 (가중치 20%) */
  cash_health_score: number | null;
  /** 캐시 런웨이 — 현금 대비 연간 소진율 (가중치 18%, 바이오 핵심) */
  cash_runway_score: number | null;
  /** 수익성 품질 — 영업마진·매출총이익마진 (가중치 12%) */
  margin_quality_score: number | null;
  /** 가중 합산 0~100 */
  total: number;
  /** 한글 등급 라벨: "우량" | "양호" | "보통" | "주의" | "위험" */
  grade_label: string;
  /** 유효 축 수 (2 미만이면 신뢰도 낮음) */
  axes_available: number;
};

export type FundamentalModelContextFile = {
  generated_at: string;
  source_bundle: string | null;
  by_ticker: Record<string, FundamentalSnapshotForModel>;
};
