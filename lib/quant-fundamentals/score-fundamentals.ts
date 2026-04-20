/**
 * 바이오 소형주 특화 펀더멘탈 서브스코어 v2 (기술 총점과 완전 독립)
 *
 * 5개 축:
 *  1. 영업이익 방향성  30% — 흑자여부 + 연속 개선/악화 추세
 *  2. 매출 성장       20% — YoY 매출 증감률
 *  3. 재무 건전성     20% — currentRatio, totalCash vs totalDebt
 *  4. 캐시 런웨이     18% — 현금/연간소진 = 생존 가능 개월 수 (바이오 핵심)
 *  5. 수익성 품질     12% — operatingMargins, grossMargins
 *
 * 바이오 소형주 특성:
 *  - 대부분 적자이므로 "적자 개선"도 가치가 있음
 *  - 현금 소진율(cash runway)이 생존에 직결 — 12개월 미만이면 위험
 *  - 매출이 없는 파이프라인 기업도 현금 런웨이로 평가 가능
 *
 * 데이터 없는 축은 null(무시). 유효 축이 2개 미만이면 null 반환.
 */

import type { FundamentalScoreBreakdown, FundamentalSnapshotForModel, StatementPeriodHighlight } from "./types";

// ── 1. 영업이익 방향성 (35%) ─────────────────────────────────────────────────

/**
 * 흑자·적자 여부 + 연속 개선 트렌드를 종합.
 * - 최근기 흑자 + 개선 추세 → 높은 점수
 * - 적자 심화 → 낮은 점수
 * - 바이오 초기 기업 특성상 적자라도 적자 개선이면 어느 정도 점수 줌
 */
function profitDirectionScore(stmt: StatementPeriodHighlight[]): number | null {
  const sorted = [...stmt]
    .filter((h) => h.operating_income !== null)
    .sort((a, b) => (a.period_end < b.period_end ? 1 : -1)); // 최신 → 오래된 순

  if (sorted.length === 0) return null;

  const latest = sorted[0].operating_income!;
  const isProfit = latest > 0;

  // 개선/악화 추세 판단 (2기 이상 있을 때)
  let trendBonus = 0;
  if (sorted.length >= 2) {
    const prev = sorted[1].operating_income!;
    const delta = latest - prev;
    // 흑자폭 확대 or 적자 개선
    if (delta > 0) trendBonus = 15;
    else if (delta < -Math.abs(prev) * 0.15) trendBonus = -15; // 15%이상 악화
  }
  if (sorted.length >= 3) {
    const prev2 = sorted[2].operating_income!;
    const d1 = sorted[0].operating_income! - sorted[1].operating_income!;
    const d2 = sorted[1].operating_income! - prev2;
    if (d1 > 0 && d2 > 0) trendBonus = Math.min(trendBonus + 10, 20); // 2연속 개선
    else if (d1 < 0 && d2 < 0) trendBonus = Math.max(trendBonus - 10, -20); // 2연속 악화
  }

  let base: number;
  if (isProfit) {
    // 매출 대비 영업이익률 계산 (stmt에 revenue가 있으면)
    const rev = sorted[0].total_revenue;
    if (rev && rev > 0) {
      const margin = latest / rev;
      if (margin >= 0.15) base = 80;
      else if (margin >= 0.08) base = 68;
      else if (margin >= 0.03) base = 56;
      else base = 48; // 흑자이지만 마진 매우 낮음
    } else {
      base = 58; // revenue 없으면 흑자라는 것만 반영
    }
  } else {
    // 적자 — 얼마나 심한지 (revenue 대비 손실)
    const rev = sorted[0].total_revenue;
    if (rev && rev > 0) {
      const lossRatio = Math.abs(latest) / rev;
      if (lossRatio < 0.05) base = 35;       // 소폭 적자
      else if (lossRatio < 0.15) base = 22;
      else if (lossRatio < 0.30) base = 14;
      else base = 8;                          // 대규모 적자
    } else {
      base = 18; // revenue도 없고 적자
    }
  }

  return Math.min(100, Math.max(0, base + trendBonus));
}

// ── 2. 매출 성장 (25%) ──────────────────────────────────────────────────────

/**
 * metrics.revenueGrowth(YoY%) 우선, 없으면 statement_highlights YoY 직접 계산.
 * 바이오는 성장이 핵심 — 20%+ 이상이면 우량.
 */
function revenueGrowthScore(
  metrics: Record<string, string | number | null>,
  stmt: StatementPeriodHighlight[]
): number | null {
  let growthRate: number | null = null;

  const raw = metrics.revenueGrowth;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    growthRate = raw; // Yahoo는 소수 (0.25 = 25%)
  } else {
    // statement_highlights에서 YoY 계산
    const sorted = [...stmt]
      .filter((h) => h.total_revenue !== null && h.total_revenue! > 0)
      .sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
    if (sorted.length >= 2) {
      const cur = sorted[0].total_revenue!;
      const prev = sorted[1].total_revenue!;
      growthRate = (cur - prev) / prev;
    }
  }

  if (growthRate === null) return null;

  const g = growthRate; // 소수 형태
  if (g >= 0.30)  return 90;
  if (g >= 0.20)  return 78;
  if (g >= 0.10)  return 65;
  if (g >= 0.05)  return 55;
  if (g >= 0.00)  return 45;
  if (g >= -0.05) return 32;
  if (g >= -0.15) return 20;
  return 10; // 급락
}

// ── 3. 재무 건전성 (25%) ────────────────────────────────────────────────────

/**
 * currentRatio + (totalCash / totalDebt) 조합.
 * 바이오 특성: 현금 소진율이 생존에 직결 — 현금 > 부채면 높은 점수.
 */
function cashHealthScore(metrics: Record<string, string | number | null>): number | null {
  const cr = typeof metrics.currentRatio === "number" ? metrics.currentRatio : null;
  const cash = typeof metrics.totalCash === "number" ? metrics.totalCash : null;
  const debt = typeof metrics.totalDebt === "number" ? metrics.totalDebt : null;

  let crScore: number | null = null;
  if (cr !== null) {
    if (cr >= 3.0) crScore = 90;
    else if (cr >= 2.0) crScore = 75;
    else if (cr >= 1.5) crScore = 62;
    else if (cr >= 1.0) crScore = 48;
    else if (cr >= 0.7) crScore = 28;
    else crScore = 12;
  }

  let cashDebtScore: number | null = null;
  if (cash !== null && debt !== null) {
    if (debt === 0) {
      cashDebtScore = 95;
    } else {
      const ratio = cash / debt;
      if (ratio >= 1.0) cashDebtScore = 90;
      else if (ratio >= 0.7) cashDebtScore = 72;
      else if (ratio >= 0.4) cashDebtScore = 52;
      else if (ratio >= 0.2) cashDebtScore = 30;
      else cashDebtScore = 14;
    }
  } else if (cash !== null && debt === null) {
    cashDebtScore = 70; // 부채 정보 없지만 현금은 있음
  }

  if (crScore === null && cashDebtScore === null) return null;
  if (crScore === null) return cashDebtScore;
  if (cashDebtScore === null) return crScore;
  return Math.round(crScore * 0.4 + cashDebtScore * 0.6);
}

// ── 4. 수익성 품질 (15%) ────────────────────────────────────────────────────

/**
 * grossMargins + operatingMargins.
 * 마진이 있다는 것 자체가 사업 모델 검증.
 * 바이오 완제품 기업은 gross 50%+ 정상, 영업마진은 업종 편차 큼.
 */
function marginQualityScore(metrics: Record<string, string | number | null>): number | null {
  const gm = typeof metrics.grossMargins === "number" ? metrics.grossMargins : null;
  const om = typeof metrics.operatingMargins === "number" ? metrics.operatingMargins : null;

  let gmScore: number | null = null;
  if (gm !== null) {
    if (gm >= 0.60) gmScore = 90;
    else if (gm >= 0.45) gmScore = 75;
    else if (gm >= 0.30) gmScore = 58;
    else if (gm >= 0.15) gmScore = 42;
    else if (gm >= 0) gmScore = 28;
    else gmScore = 10;
  }

  let omScore: number | null = null;
  if (om !== null) {
    if (om >= 0.20) omScore = 90;
    else if (om >= 0.10) omScore = 72;
    else if (om >= 0.04) omScore = 56;
    else if (om >= 0) omScore = 40;
    else if (om >= -0.10) omScore = 24;
    else if (om >= -0.25) omScore = 14;
    else omScore = 6;
  }

  if (gmScore === null && omScore === null) return null;
  if (gmScore === null) return omScore;
  if (omScore === null) return gmScore;
  return Math.round(gmScore * 0.45 + omScore * 0.55);
}

// ── 5. 캐시 런웨이 (18%) — 바이오 소형주 핵심 생존 지표 ──────────────────────

/**
 * 현금 / 연간 순소진(영업CF 적자) = 생존 가능 개월 수.
 * 바이오 소형주는 매출이 없거나 적자가 일상 → 보유 현금으로 버틸 수 있는 기간이 핵심.
 *
 * 산식: totalCash / abs(영업손실_연환산) × 12
 *       operatingCashflow가 있으면 그것으로, 없으면 operating_income으로 대체.
 *
 * 36개월 이상이면 우량, 12개월 미만이면 위험(유증 필요).
 */
function cashRunwayScore(
  metrics: Record<string, string | number | null>,
  stmt: StatementPeriodHighlight[]
): number | null {
  const cash = typeof metrics.totalCash === "number" ? metrics.totalCash : null;
  if (cash === null || cash <= 0) return null;

  let annualBurn: number | null = null;

  const ocf = typeof metrics.operatingCashflow === "number" ? metrics.operatingCashflow : null;
  if (ocf !== null && ocf < 0) {
    annualBurn = Math.abs(ocf);
  } else {
    const sorted = [...stmt]
      .filter((h) => h.operating_income !== null)
      .sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
    if (sorted.length > 0 && sorted[0].operating_income! < 0) {
      annualBurn = Math.abs(sorted[0].operating_income!);
    }
  }

  if (annualBurn === null || annualBurn <= 0) {
    return ocf !== null && ocf >= 0 ? 85 : null;
  }

  const runwayMonths = (cash / annualBurn) * 12;

  if (runwayMonths >= 48) return 95;
  if (runwayMonths >= 36) return 82;
  if (runwayMonths >= 24) return 68;
  if (runwayMonths >= 18) return 55;
  if (runwayMonths >= 12) return 40;
  if (runwayMonths >= 6)  return 22;
  return 8;
}

// ── 종합 ────────────────────────────────────────────────────────────────────

function gradeLabelFromTotal(total: number): string {
  if (total >= 80) return "우량";
  if (total >= 65) return "양호";
  if (total >= 50) return "보통";
  if (total >= 35) return "주의";
  return "위험";
}

export function computeFundamentalScore(
  snap: FundamentalSnapshotForModel
): FundamentalScoreBreakdown | null {
  if (snap.data_quality === "missing") return null;

  const m = snap.metrics;
  const stmt = snap.statement_highlights ?? [];

  const w = { profit: 30, revenue: 20, cash: 20, runway: 18, margin: 12 };

  const profit_direction_score = profitDirectionScore(stmt);
  const revenue_growth_score = revenueGrowthScore(m, stmt);
  const cash_health_score = cashHealthScore(m);
  const cash_runway_score_val = cashRunwayScore(m, stmt);
  const margin_quality_score = marginQualityScore(m);

  const scores: Array<{ score: number; weight: number }> = [];
  if (profit_direction_score !== null) scores.push({ score: profit_direction_score, weight: w.profit });
  if (revenue_growth_score !== null) scores.push({ score: revenue_growth_score, weight: w.revenue });
  if (cash_health_score !== null) scores.push({ score: cash_health_score, weight: w.cash });
  if (cash_runway_score_val !== null) scores.push({ score: cash_runway_score_val, weight: w.runway });
  if (margin_quality_score !== null) scores.push({ score: margin_quality_score, weight: w.margin });

  const axes_available = scores.length;
  if (axes_available < 2) return null;

  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  const weighted = scores.reduce((s, x) => s + x.score * x.weight, 0);
  const total = Math.min(100, Math.max(0, Math.round(weighted / totalWeight)));

  return {
    profit_direction_score,
    revenue_growth_score,
    cash_health_score,
    cash_runway_score: cash_runway_score_val,
    margin_quality_score,
    total,
    grade_label: gradeLabelFromTotal(total),
    axes_available,
  };
}
