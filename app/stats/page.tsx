import fs from "fs";
import path from "path";
import { StrategyChart } from "./StrategyChart";

export const metadata = {
  title: "뉴스 기반 주가 반응 분석 보고서 | FAM",
  description: "기사 퍼블리싱 이후 입장 시점 및 보유 기간별 수익률·승률 정량 분석",
};

type ClusteringData = {
  generated_at: string;
  stats: { total_articles: number; total_pairs_analyzed: number; skipped_no_data: number; skipped_no_future: number };
  cluster_distribution: Record<string, number>;
  top_positive: Array<{
    ticker: string;
    name: string;
    count_1d: number;
    positive_rate_1d: number | null;
    avg_return_1d: number | null;
    positive_rate_3d: number | null;
    positive_rate_5d: number | null;
    cluster_1d: string | null;
  }>;
};

type ArticleTypeData = {
  generated_at: string;
  summary: Array<{
    type: string;
    count: number;
    avg_ret_t0: number;
    avg_ret_t1: number;
    avg_ret_t5: number;
    win_rate_t0: number;
    win_rate_t1: number;
    win_rate_t5: number;
  }>;
};

type MarketBaselineDeep = {
  total: number;
  baseline_returns_pct: { "1d": number; "5d": number; "7d": number; "10d": number };
  groups: Array<{
    label: string;
    desc: string;
    count: number;
    pct_of_total: number;
    avg_ret_1d_pct: number;
    avg_ret_5d_pct: number;
    avg_ret_7d_pct: number;
    avg_ret_10d_pct: number;
    contrib_1d_pp: number;
    contrib_5d_pp: number;
  }>;
  insight: string;
};

type AdvancedStatsData = {
  generated_at: string;
  strategy_performance: Array<{
    strategy: string;
    count: number;
    win_rate_1d?: number | null;
    avg_ret_1d?: number | null;
    win_rate_5d?: number | null;
    avg_ret_5d?: number | null;
    win_rate_7d?: number | null;
    avg_ret_7d?: number | null;
    win_rate_10d?: number | null;
    avg_ret_10d?: number | null;
  }>;
  market_baseline_deep?: MarketBaselineDeep;
  strategy_matches: Array<{
    ticker: string;
    name: string;
    title: string;
    vol_ratio: number;
    gap_pct: number;
    ret_t0: number;
    pre_event_ret: number;
    strategies: string[];
    returns: Record<string, number | null>;
    t0_date: string;
  }>;
};

type EntryHoldData = {
  generated_at: string;
  summary: {
    best_win_rate: { entry_label: string; hold_days: number; win_rate: number; avg_return: number; count: number };
    best_avg_return: { entry_label: string; hold_days: number; win_rate: number; avg_return: number; count: number };
  };
  detail: Array<{ entry: string; entry_label: string; hold_days: number; count: number; win_rate: number; avg_return: number }>;
};

type TopSurgeItem = {
  rank: number;
  ticker: string;
  name: string;
  title: string;
  ret_pct: number;
  ret_t0_pct: number;
  vol_ratio: number;
  gap_pct: number;
  strategies: string[];
  pattern_group: string;
  article_types: string[];
  t0_date: string;
};

type TopSurgeData = {
  generated_at: string;
  horizons: number[];
  top_n: number;
  total_pairs: number;
  top_by_horizon: Record<string, TopSurgeItem[]>;
  characteristics: Record<string, {
    count: number;
    pattern_group: Record<string, number>;
    strategies: Record<string, number>;
    article_types: Record<string, number>;
    avg_vol_ratio: number;
    avg_gap_pct: number;
    avg_ret_t0_pct: number;
  }>;
  best_per_horizon: Record<string, TopSurgeItem>;
};

function loadJson<T>(file: string): T | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", file), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function pct(v: number | null | undefined): string {
  return v == null ? "-" : `${(v * 100).toFixed(1)}%`;
}

function ret(v: number | null | undefined): string {
  return v == null ? "-" : `${(v * 100).toFixed(2)}%`;
}

const STRATEGY_LABELS: Record<string, string> = {
  Baseline: "시장 평균",
  "Strategy A": "뉴스당일 거래량 3배 이상 (과열)",
  "Strategy B": "뉴스당일 갭상승 2%+ 양봉 (급등)",
  "Strategy C": "직전 5일 -5%+ 하락 후 뉴스당일 양봉 (과매도 반등)",
  "Strategy D": "뉴스당일 거래량 1.5~3배·주가 1~5% 상승",
};
function strategyLabel(s: string): string {
  return STRATEGY_LABELS[s] ?? s;
}

const reportStyles = {
  page: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "56px 40px 80px",
    fontSize: "15px",
    backgroundColor: "#fff",
    color: "#1a1a1a",
    minHeight: "100vh",
    lineHeight: 1.6,
  },
  header: {
    paddingBottom: "28px",
    marginBottom: "56px",
    borderBottom: "1px solid #e5e5e5",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  meta: {
    fontSize: "13px",
    color: "#525252",
    marginTop: "8px",
  },
  section: {
    marginBottom: "64px",
  },
  h1: {
    fontSize: "17px",
    fontWeight: 600,
    marginBottom: "20px",
    marginTop: 0,
  },
  h2: {
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "12px",
    marginTop: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "14px",
  },
  th: {
    borderBottom: "1px solid #1a1a1a",
    padding: "12px 14px",
    textAlign: "left" as const,
    fontWeight: 600,
  },
  td: {
    borderBottom: "1px solid #e5e5e5",
    padding: "12px 14px",
    fontWeight: 500,
  },
  tdRight: {
    borderBottom: "1px solid #e5e5e5",
    padding: "12px 14px",
    textAlign: "right" as const,
    fontWeight: 500,
  },
  footer: {
    marginTop: "64px",
    paddingTop: "32px",
    borderTop: "1px solid #e5e5e5",
    fontSize: "14px",
    color: "#737373",
  },
};

export default function StatsPage() {
  const clusteringData = loadJson<ClusteringData>("post_publish_positive_clustering.json");
  const advancedData = loadJson<AdvancedStatsData>("advanced_stats.json");
  const entryHoldData = loadJson<EntryHoldData>("entry_hold_stats.json");
  const articleTypeData = loadJson<ArticleTypeData>("article_type_stats.json");
  const topSurgeData = loadJson<TopSurgeData>("top_surge_analysis.json");

  const reportDate = entryHoldData?.generated_at && new Date(entryHoldData.generated_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={reportStyles.page}>
      {/* Report Header */}
      <header style={reportStyles.header}>
        <h1 style={reportStyles.title}>뉴스 기반 주가 반응 분석 보고서</h1>
        <p style={reportStyles.meta}>
          Report No. FAM-STAT-001 | 분석 기준일: {reportDate ?? "-"} | 데이터: pharm.edaily.co.kr
        </p>
      </header>

      {/* Executive Summary */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>1. 요약 (Executive Summary)</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          본 보고서는 바이오/제약 뉴스에 노출된 종목의 수익률을 기사 유형, 입장 시점 및 보유 기간별로 정량 분석한 결과를 담는다.
          총 <strong>{clusteringData?.stats.total_articles ?? 0}건</strong>의 기사에서 추출된 <strong>{clusteringData?.stats.total_pairs_analyzed ?? 0}건</strong>의 기사-종목 쌍을 대상으로 분석하였다.
        </p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px 56px", marginTop: "28px", padding: "28px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #f0f0f0" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#525252", marginBottom: "4px" }}>데이터 구성</div>
            <div style={{ fontSize: "13px" }}>
              • 분석 대상 기사: {clusteringData?.stats.total_articles}건<br/>
              • 분석 대상 쌍(Pair): {clusteringData?.stats.total_pairs_analyzed}건<br/>
              • 제외된 데이터: {(clusteringData?.stats.skipped_no_data ?? 0) + (clusteringData?.stats.skipped_no_future ?? 0)}건
            </div>
          </div>
          {entryHoldData && (
            <div>
              <div style={{ fontSize: "12px", color: "#525252", marginBottom: "4px" }}>최적 투자 시나리오</div>
              <div style={{ fontSize: "13px" }}>
                • <strong>최고 승률:</strong> {entryHoldData.summary.best_win_rate.entry_label} ({pct(entryHoldData.summary.best_win_rate.win_rate)})<br/>
                • <strong>최고 수익:</strong> {entryHoldData.summary.best_avg_return.entry_label} ({ret(entryHoldData.summary.best_avg_return.avg_return)})<br/>
                • <strong>권장 보유:</strong> {entryHoldData.summary.best_win_rate.hold_days} ~ {entryHoldData.summary.best_avg_return.hold_days} 거래일
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. 기사 유형별 성과 분석 */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>2. 기사 유형별 성과 분석</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          기사 제목의 키워드를 분석하여 유형을 분류하고, 각 유형별 당일(T0) 및 이후 수익률을 산출하였다.
        </p>
        {articleTypeData && (
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={reportStyles.table}>
              <thead>
                <tr>
                  <th style={reportStyles.th}>기사 유형</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>표본</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>당일(T0) 평균</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>당일 승률</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>T+1 수익률</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>T+5 수익률</th>
                </tr>
              </thead>
              <tbody>
                {articleTypeData.summary.map((r, i) => (
                  <tr key={i}>
                    <td style={reportStyles.td}><strong>{r.type}</strong></td>
                    <td style={reportStyles.tdRight}>{r.count}</td>
                    <td style={{ ...reportStyles.tdRight, color: r.avg_ret_t0 > 0 ? "#dc2626" : "#2563eb" }}>{ret(r.avg_ret_t0)}</td>
                    <td style={reportStyles.tdRight}>{pct(r.win_rate_t0)}</td>
                    <td style={reportStyles.tdRight}>{ret(r.avg_ret_t1)}</td>
                    <td style={reportStyles.tdRight}>{ret(r.avg_ret_t5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. 입장 시점 및 보유 기간 분석 */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>3. 입장 시점 및 보유 기간 분석</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          <strong>언제 사고, 얼마나 들고 있어야 할까?</strong> 뉴스가 나온 뒤 세 가지 입장 시점을 비교했다.
        </p>
        <ul style={{ margin: "0 0 12px", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li><strong>T=0 종가</strong>: 뉴스 나온 당일 장 마감가에 매수</li>
          <li><strong>T+1 시가</strong>: 다음날 장 시작가에 매수 (당일 급등 피하고 다음날 들어감)</li>
          <li><strong>T+1 종가</strong>: 다음날 장 마감가에 매수 (되돌림 후 들어감)</li>
        </ul>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6, color: "#166534", fontWeight: 600 }}>
          → 결과: <strong>다음날 시가(T+1)에 사서 7~10일 보유</strong>가 승률·수익률 모두 가장 좋았다.
        </p>
        {entryHoldData && (
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={reportStyles.table}>
              <thead>
                <tr>
                  <th style={reportStyles.th}>입장 시점</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>보유(일)</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>표본</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>승률</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>평균 수익률</th>
                </tr>
              </thead>
              <tbody>
                {entryHoldData.detail.slice(0, 15).map((r, i) => {
                  const isBestWinRate = r.entry === "B" && r.hold_days === entryHoldData.summary.best_win_rate.hold_days;
                  const isBestReturn = r.entry === "B" && r.hold_days === entryHoldData.summary.best_avg_return.hold_days;
                  const isBest = isBestWinRate || isBestReturn;
                  return (
                    <tr
                      key={i}
                      style={isBest ? { backgroundColor: "#dcfce7" } : undefined}
                    >
                      <td style={reportStyles.td}>{r.entry_label}</td>
                      <td style={reportStyles.tdRight}>{r.hold_days}</td>
                      <td style={reportStyles.tdRight}>{r.count}</td>
                      <td style={reportStyles.tdRight}>{pct(r.win_rate)}</td>
                      <td style={reportStyles.tdRight}>{ret(r.avg_return)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ marginTop: "8px", fontSize: "0.8125rem", color: "#525252" }}>
              초록 = 최고 승률 또는 최고 수익률 조건
            </p>
          </div>
        )}
      </section>

      {/* 4. 가격 반응 기반 전략 성과 */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>4. 가격 반응 기반 전략 성과</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          <strong>뉴스 반응일(T0)의 가격·거래량 패턴</strong>으로 이후 수익을 예측한다.
        </p>
        <ul style={{ margin: "0 0 12px", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li><strong>A</strong> 뉴스당일 거래량 3배 이상 (과열)</li>
          <li><strong>B</strong> 뉴스당일 갭상승 2%+ 양봉 (급등)</li>
          <li><strong>C</strong> 직전 5일 -5%+ 하락 후 뉴스당일 양봉 (과매도 반등)</li>
          <li><strong>D</strong> 뉴스당일 거래량 1.5~3배·주가 1~5% 상승</li>
        </ul>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6, fontWeight: 600 }}>
          → <strong>추천</strong>: C 또는 D이면서 A·B 없음 / <strong>관망</strong>: A 또는 B 포함 (과열·급등 후 조정)
        </p>
        {advancedData && (
          <>
            {/* 4-0. 시장 평균(669건) 심층분석 */}
            {advancedData.market_baseline_deep && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={reportStyles.h2}>시장 평균(669건) 심층분석</h3>
                <p style={{ margin: "0 0 12px", fontSize: "13px" }}>
                  전체 {advancedData.market_baseline_deep.total}건을 상호배타 그룹으로 나누어 구성·기여도 분석.
                </p>
                <ul style={{ margin: "0 0 12px", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
                  {advancedData.market_baseline_deep.groups.map((g) => (
                    <li key={g.label}>
                      <strong>{g.label}</strong> ({g.count}건, {g.pct_of_total}%) — {g.desc}
                      <br />
                      <span style={{ fontSize: "12px" }}>1일 {g.avg_ret_1d_pct >= 0 ? "+" : ""}{g.avg_ret_1d_pct}% (기여 {g.contrib_1d_pp >= 0 ? "+" : ""}{g.contrib_1d_pp}%p) · 5일 {g.avg_ret_5d_pct >= 0 ? "+" : ""}{g.avg_ret_5d_pct}% (기여 {g.contrib_5d_pp >= 0 ? "+" : ""}{g.contrib_5d_pp}%p) · 7일 {g.avg_ret_7d_pct >= 0 ? "+" : ""}{g.avg_ret_7d_pct}% · 10일 {g.avg_ret_10d_pct >= 0 ? "+" : ""}{g.avg_ret_10d_pct}%</span>
                    </li>
                  ))}
                </ul>
                <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
                  {advancedData.market_baseline_deep.insight}
                </p>
              </div>
            )}
            <div style={{ marginBottom: "32px" }}>
              <StrategyChart
                data={advancedData.strategy_performance.filter((r) =>
                  r.strategy === "Baseline" || ["Strategy A", "Strategy B", "Strategy C", "Strategy D"].includes(r.strategy)
                )}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", overflowX: "auto" }}>
              <div>
                <h3 style={reportStyles.h2}>승률 (Win Rate)</h3>
                <table style={reportStyles.table}>
                  <thead>
                    <tr>
                      <th style={reportStyles.th}>전략</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>표본</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>1일</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>5일</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>7일</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>10일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedData.strategy_performance
                      .filter((r) => r.strategy === "Baseline" || ["Strategy A", "Strategy B", "Strategy C", "Strategy D"].includes(r.strategy))
                      .map((row) => (
                        <tr key={`wr-${row.strategy}`}>
                          <td style={reportStyles.td}>{strategyLabel(row.strategy)}</td>
                          <td style={reportStyles.tdRight}>{row.count}</td>
                          <td style={reportStyles.tdRight}>{pct(row.win_rate_1d)}</td>
                          <td style={reportStyles.tdRight}>{pct(row.win_rate_5d)}</td>
                          <td style={reportStyles.tdRight}>{pct(row.win_rate_7d)}</td>
                          <td style={reportStyles.tdRight}>{pct(row.win_rate_10d)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p style={{ marginTop: "8px", fontSize: "0.8125rem", color: "#525252" }}>
                  표본: 해당 패턴 건수 · 1일/5일/7일/10일: 뉴스 반응일 이후 N일 뒤 수익률이 양수인 비율(승률)
                </p>
              </div>
              <div>
                <h3 style={reportStyles.h2}>평균 수익률 (Avg Return)</h3>
                <table style={reportStyles.table}>
                  <thead>
                    <tr>
                      <th style={reportStyles.th}>전략</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>표본</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>1일</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>5일</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>7일</th>
                      <th style={{ ...reportStyles.th, textAlign: "right" }}>10일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedData.strategy_performance
                      .filter((r) => r.strategy === "Baseline" || ["Strategy A", "Strategy B", "Strategy C", "Strategy D"].includes(r.strategy))
                      .map((row) => (
                        <tr key={`ret-${row.strategy}`}>
                          <td style={reportStyles.td}>{strategyLabel(row.strategy)}</td>
                          <td style={reportStyles.tdRight}>{row.count}</td>
                          <td style={reportStyles.tdRight}>{ret(row.avg_ret_1d)}</td>
                          <td style={reportStyles.tdRight}>{ret(row.avg_ret_5d)}</td>
                          <td style={reportStyles.tdRight}>{ret(row.avg_ret_7d)}</td>
                          <td style={reportStyles.tdRight}>{ret(row.avg_ret_10d)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p style={{ marginTop: "8px", fontSize: "0.8125rem", color: "#525252" }}>
                  표본: 해당 패턴 건수 · 1일/5일/7일/10일: 뉴스 반응일 이후 N일 뒤 평균 수익률
                </p>
              </div>

              {/* 4-1. 전략 심층 분석 */}
              {(() => {
                const perf = Object.fromEntries(
                  advancedData.strategy_performance.map((r) => [r.strategy, r])
                );
                const baseline = perf["Baseline"];
                const strategies = [
                  { key: "Strategy A", name: "뉴스당일 거래량 3배 이상 (과열)", desc: "T0 거래량 비율 ≥ 3.0" },
                  { key: "Strategy B", name: "뉴스당일 갭상승 2%+ 양봉 (급등)", desc: "T0 갭 ≥ 2%, 종가 > 시가" },
                  { key: "Strategy C", name: "직전 5일 -5%+ 하락 후 뉴스당일 양봉 (과매도 반등)", desc: "직전 5일 수익률 < -5%, T0 수익률 > 0%" },
                  { key: "Strategy D", name: "뉴스당일 거래량 1.5~3배·주가 1~5% 상승", desc: "T0 거래량 1.5~3배, T0 수익률 1~5%" },
                ];
                const bl1 = (baseline?.avg_ret_1d ?? 0) * 100;
                const bl5 = (baseline?.avg_ret_5d ?? 0) * 100;
                const bl10 = (baseline?.avg_ret_10d ?? 0) * 100;
                const risers = strategies.filter((s) => {
                  const r = perf[s.key];
                  const r1 = (r?.avg_ret_1d ?? 0) * 100;
                  const r5 = (r?.avg_ret_5d ?? 0) * 100;
                  return r && r1 > bl1 && r5 > bl5;
                });
                const killers = strategies.filter((s) => {
                  const r = perf[s.key];
                  const r1 = (r?.avg_ret_1d ?? 0) * 100;
                  const r5 = (r?.avg_ret_5d ?? 0) * 100;
                  return r && (r1 < 0 || r5 < 0);
                });
                return (
                  <div style={{ marginTop: "24px" }}>
                    <h3 style={reportStyles.h2}>4-1. 전략 심층 분석</h3>
                    <div style={{ marginBottom: "16px" }}>
                      <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>상승을 이끈 전략</h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.7 }}>
                        {risers.map((s) => {
                          const r = perf[s.key];
                          const r1 = (r?.avg_ret_1d ?? 0) * 100;
                          const r5 = (r?.avg_ret_5d ?? 0) * 100;
                          const r10 = (r?.avg_ret_10d ?? 0) * 100;
                          const d1 = r1 - bl1;
                          const d5 = r5 - bl5;
                          return (
                            <li key={s.key}>
                              <strong>{s.name}</strong> ({r?.count ?? 0}건) — {s.desc}
                              <br />
                              <span style={{ fontSize: "12px" }}>1일 {r1 >= 0 ? "+" : ""}{r1.toFixed(2)}% (시장 대비 {d1 >= 0 ? "+" : ""}{d1.toFixed(2)}%p) · 5일 {r5 >= 0 ? "+" : ""}{r5.toFixed(2)}% (시장 대비 {d5 >= 0 ? "+" : ""}{d5.toFixed(2)}%p) · 10일 {r10 >= 0 ? "+" : ""}{r10.toFixed(2)}%</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>수익을 죽인 전략</h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.7 }}>
                        {killers.map((s) => {
                          const r = perf[s.key];
                          const r1 = (r?.avg_ret_1d ?? 0) * 100;
                          const r5 = (r?.avg_ret_5d ?? 0) * 100;
                          const r7 = (r?.avg_ret_7d ?? 0) * 100;
                          const wr = ((r?.win_rate_1d ?? 0) * 100).toFixed(1);
                          return (
                            <li key={s.key}>
                              <strong>{s.name}</strong> ({r?.count ?? 0}건) — {s.desc}
                              <br />
                              <span style={{ fontSize: "12px" }}>1일 {r1 >= 0 ? "+" : ""}{r1.toFixed(2)}% (승률 {wr}%) · 5일 {r5 >= 0 ? "+" : ""}{r5.toFixed(2)}% · 7일 {r7 >= 0 ? "+" : ""}{r7.toFixed(2)}% → 단기 과열/급등 후 조정</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
                      A·B는 과열 신호로 1~7일 마이너스. C·D는 건전한 반등으로 전 구간 플러스. <strong>실전: A·B 패턴이면 관망, C·D 패턴이면 매수 유리.</strong>
                    </p>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </section>

      {/* 5. 종목별 양전 클러스터링 */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>5. 종목별 양전 클러스터링</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          기사 노출 후 T+1일 상승 확률 기준 상/중/하 3분위 클러스터링.
        </p>
        {clusteringData?.cluster_distribution && (
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={reportStyles.table}>
              <thead>
                <tr>
                  <th style={reportStyles.th}>클러스터</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>종목 수</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(clusteringData.cluster_distribution).map(([k, v]) => (
                  <tr key={k}>
                    <td style={reportStyles.td}>{k}</td>
                    <td style={reportStyles.tdRight}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. 전략 포착 사례 (부록) */}
      {advancedData?.strategy_matches && advancedData.strategy_matches.length > 0 && (
        <section style={reportStyles.section}>
          <h2 style={reportStyles.h1}>6. 부록: 전략 포착 사례</h2>
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={reportStyles.table}>
              <thead>
                <tr>
                  <th style={reportStyles.th}>일자</th>
                  <th style={reportStyles.th}>종목</th>
                  <th style={reportStyles.th}>전략</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>거래량비율</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>당일반응</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>T+1</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>T+5</th>
                </tr>
              </thead>
              <tbody>
                {advancedData.strategy_matches.slice(0, 30).map((row, idx) => (
                  <tr key={idx}>
                    <td style={reportStyles.td}>{row.t0_date}</td>
                    <td style={reportStyles.td}>{row.name} ({row.ticker})</td>
                    <td style={reportStyles.td}>{row.strategies.join(", ")}</td>
                    <td style={reportStyles.tdRight}>{row.vol_ratio.toFixed(1)}x</td>
                    <td style={reportStyles.tdRight}>{ret(row.ret_t0)}</td>
                    <td style={reportStyles.tdRight}>{ret(row.returns["1"])}</td>
                    <td style={reportStyles.tdRight}>{ret(row.returns["5"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7. 기사 출간 후 급등 종목 */}
      {topSurgeData && (
        <section style={reportStyles.section}>
          <h2 style={reportStyles.h1}>7. 기사 출간 후 급등 종목 (1d·2d·3d·10d)</h2>
          <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
            T0(반응일) 종가 진입 후 각 보유 기간별 가장 많이 급등한 종목 상위 {topSurgeData.top_n}개 및 성격 분석.
            총 {topSurgeData.total_pairs}건 (기사×종목) 기준.
          </p>

          {/* 기간별 1위 */}
          <h3 style={reportStyles.h2}>기간별 1위</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {topSurgeData.horizons.map((h) => {
              const best = topSurgeData.best_per_horizon[String(h)];
              if (!best) return null;
              return (
                <div
                  key={h}
                  style={{
                    padding: "14px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    border: "1px solid #e5e5e5",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#525252", marginBottom: "4px" }}>T+{h}일</div>
                  <div style={{ fontWeight: 600, marginBottom: "2px" }}>{best.name} ({best.ticker})</div>
                  <div style={{ fontSize: "15px", color: "#dc2626", fontWeight: 600 }}>
                    {best.ret_pct >= 0 ? "+" : ""}{best.ret_pct}%
                  </div>
                  <div style={{ fontSize: "12px", color: "#737373", marginTop: "4px" }}>
                    {best.pattern_group} {best.strategies.length > 0 ? `| ${best.strategies.join(",")}` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 기간별 성격 요약 */}
          <h3 style={reportStyles.h2}>상위 30개 성격 요약</h3>
          <div style={{ overflowX: "auto", marginBottom: "24px" }}>
            <table style={reportStyles.table}>
              <thead>
                <tr>
                  <th style={reportStyles.th}>기간</th>
                  <th style={reportStyles.th}>패턴 분포</th>
                  <th style={reportStyles.th}>전략 분포</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>평균 vol_ratio</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>평균 gap%</th>
                  <th style={{ ...reportStyles.th, textAlign: "right" }}>평균 T0반응%</th>
                </tr>
              </thead>
              <tbody>
                {topSurgeData.horizons.map((h) => {
                  const c = topSurgeData.characteristics[String(h)];
                  if (!c) return null;
                  const patternStr = Object.entries(c.pattern_group)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ");
                  const stratStr = Object.entries(c.strategies)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ") || "-";
                  return (
                    <tr key={h}>
                      <td style={reportStyles.td}>T+{h}일</td>
                      <td style={reportStyles.td}>{patternStr}</td>
                      <td style={reportStyles.td}>{stratStr}</td>
                      <td style={reportStyles.tdRight}>{c.avg_vol_ratio}</td>
                      <td style={reportStyles.tdRight}>{c.avg_gap_pct}%</td>
                      <td style={reportStyles.tdRight}>{c.avg_ret_t0_pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* T+1d, T+10d 상위 10개 테이블 */}
          <h3 style={reportStyles.h2}>T+1일·T+10일 상위 10개</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", overflowX: "auto" }}>
            {[1, 10].map((h) => {
              const list = topSurgeData.top_by_horizon[String(h)]?.slice(0, 10) ?? [];
              return (
                <div key={h}>
                  <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>T+{h}일</h4>
                  <table style={reportStyles.table}>
                    <thead>
                      <tr>
                        <th style={reportStyles.th}>#</th>
                        <th style={reportStyles.th}>종목</th>
                        <th style={{ ...reportStyles.th, textAlign: "right" }}>수익률</th>
                        <th style={reportStyles.th}>성격</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, idx) => (
                        <tr key={`${h}-${idx}-${r.ticker}-${r.t0_date}`}>
                          <td style={reportStyles.td}>{r.rank}</td>
                          <td style={reportStyles.td}>{r.name}</td>
                          <td style={{ ...reportStyles.tdRight, color: r.ret_pct >= 0 ? "#dc2626" : "#2563eb" }}>
                            {r.ret_pct >= 0 ? "+" : ""}{r.ret_pct}%
                          </td>
                          <td style={reportStyles.td}>{r.pattern_group}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer style={reportStyles.footer}>
        본 보고서는 과거 데이터 기반 백테스트 결과이며, 향후 수익을 보장하지 않는다.
        데이터 갱신: python3 scripts/advanced_analysis.py, python3 scripts/entry_hold_analysis.py, python3 scripts/top_surge_analysis.py
      </footer>
    </div>
  );
}
