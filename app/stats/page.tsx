import fs from "fs";
import path from "path";
import { StatsSummaryCharts } from "./StatsSummaryCharts";
import { StatsReportFaq } from "./StatsReportFaq";

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
  const topSurgeData = loadJson<TopSurgeData>("top_surge_analysis.json");

  const reportDate = entryHoldData?.generated_at && new Date(entryHoldData.generated_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const baselineRow = advancedData?.strategy_performance?.find((s) => s.strategy === "Baseline");
  const bestWin = entryHoldData?.summary.best_win_rate;
  const bestRet = entryHoldData?.summary.best_avg_return;

  const strategyPerf = advancedData
    ? Object.fromEntries(advancedData.strategy_performance.map((r) => [r.strategy, r]))
    : null;

  return (
    <div style={reportStyles.page}>
      {/* Report Header */}
      <header style={reportStyles.header}>
        <h1 style={reportStyles.title}>뉴스 기반 주가 반응 분석 보고서</h1>
        <p style={reportStyles.meta}>
          Report No. FAM-STAT-001 | 분석 기준일: {reportDate ?? "-"} | 데이터: pharm.edaily.co.kr
        </p>
      </header>

      {/* 분석·백테스트 개요 — 3줄 수치 요약 */}
      <section style={{ marginBottom: "56px" }}>
        <h2 style={{ ...reportStyles.h1, fontSize: "18px", marginBottom: "16px" }}>
          기본 통계는 어떻게 냈고, 백테스트 수익은 얼마인가
        </h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: "1.35rem",
            lineHeight: 1.75,
            fontSize: "15px",
            color: "#1a1a1a",
          }}
        >
          <li style={{ marginBottom: "6px" }}>
            기사 <strong>{clusteringData?.stats.total_articles ?? "—"}</strong>건 → 수익 계산 케이스{" "}
            <strong>{clusteringData?.stats.total_pairs_analyzed ?? "—"}</strong>개, 시세 부족 제외{" "}
            <strong>{(clusteringData?.stats.skipped_no_data ?? 0) + (clusteringData?.stats.skipped_no_future ?? 0)}</strong>개. T0 기준{" "}
            <strong>당일 종가·익일 시가·익일 종가</strong> 3가지 매수 가정 후 보유일만 바꾼 단순 매수·보유,{" "}
            <strong>수수료·세금·슬리피지 없음</strong>.
          </li>
          <li style={{ marginBottom: "6px" }}>
            <strong>Baseline</strong>(전체 쌍, n=<strong>{baselineRow?.count ?? "—"}</strong>) —{" "}
            <strong>7거래일</strong>: 평균 <strong>{baselineRow ? ret(baselineRow.avg_ret_7d) : "—"}</strong>, 승률{" "}
            <strong>{baselineRow ? pct(baselineRow.win_rate_7d) : "—"}</strong>
            {" · "}
            <strong>10거래일</strong>: 평균 <strong>{baselineRow ? ret(baselineRow.avg_ret_10d) : "—"}</strong>, 승률{" "}
            <strong>{baselineRow ? pct(baselineRow.win_rate_10d) : "—"}</strong>
          </li>
          <li>
            <strong>퀀트 긍정 신호</strong> 조합 극값 — <strong>승률 최대</strong>:{" "}
            <strong>{bestWin?.entry_label ?? "—"}</strong>·<strong>{bestWin?.hold_days ?? "—"}</strong>일 → 수익{" "}
            <strong>{bestWin ? ret(bestWin.avg_return) : "—"}</strong>, 승률 <strong>{bestWin ? pct(bestWin.win_rate) : "—"}</strong>, n=
            <strong>{bestWin?.count ?? "—"}</strong>
            {" · "}
            <strong>평균 수익 최대</strong>: <strong>{bestRet?.entry_label ?? "—"}</strong>·<strong>{bestRet?.hold_days ?? "—"}</strong>일 → 수익{" "}
            <strong>{bestRet ? ret(bestRet.avg_return) : "—"}</strong>, 승률 <strong>{bestRet ? pct(bestRet.win_rate) : "—"}</strong>, n=
            <strong>{bestRet?.count ?? "—"}</strong>
          </li>
        </ol>
      </section>

      <StatsReportFaq />

      {/* Executive Summary */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>1. 요약 (Executive Summary)</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          본 보고서는 바이오/제약 뉴스에 노출된 종목의 수익률을 입장 시점 및 보유 기간별로 정량 분석한 결과를 담는다.
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
              <div style={{ fontSize: "12px", color: "#525252", marginBottom: "4px" }}>퀀트 긍정 신호 기준 최적 시나리오</div>
              <div style={{ fontSize: "13px" }}>
                • <strong>승률 최대 (퀀트 긍정 신호):</strong> {entryHoldData.summary.best_win_rate.entry_label} ({pct(entryHoldData.summary.best_win_rate.win_rate)})<br/>
                • <strong>평균 수익 최대 (퀀트 긍정 신호):</strong> {entryHoldData.summary.best_avg_return.entry_label} ({ret(entryHoldData.summary.best_avg_return.avg_return)})<br/>
                • <strong>권장 보유:</strong> {entryHoldData.summary.best_win_rate.hold_days} ~ {entryHoldData.summary.best_avg_return.hold_days} 거래일
              </div>
            </div>
          )}
        </div>

        <StatsSummaryCharts
          pipeline={
            clusteringData
              ? {
                  analyzed: clusteringData.stats.total_pairs_analyzed,
                  skippedNoData: clusteringData.stats.skipped_no_data,
                  skippedNoFuture: clusteringData.stats.skipped_no_future,
                }
              : null
          }
          entryWinRateAt7d={
            entryHoldData
              ? entryHoldData.detail
                  .filter((r) => r.hold_days === 7)
                  .sort((a, b) => a.entry.localeCompare(b.entry))
                  .map((r) => ({
                    label:
                      r.entry === "A"
                        ? "T=0 종가"
                        : r.entry === "B"
                          ? "T+1 시가"
                          : r.entry === "C"
                            ? "T+1 종가"
                            : r.entry_label,
                    winRatePct: r.win_rate * 100,
                  }))
              : null
          }
        />
      </section>

      {/* 2. 입장 시점 및 보유 기간 분석 */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>2. 입장 시점 및 보유 기간 분석</h2>
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

      {/* 3. T0 패턴: 약한 형태 vs 강한 형태 */}
      <section style={reportStyles.section}>
        <h2 style={reportStyles.h1}>3. 뉴스 반응일(T0) 패턴: 하락 쪽 vs 상승 쪽</h2>
        <p style={{ margin: "0 0 16px", lineHeight: 1.65, color: "#404040" }}>
          T0의 가격·거래량을 네 가지로 나눈 뒤, 이후 수익이 어디로 갈렸는지만 정리한다. (A·B는 중복 가능, C·D도 동일.)
        </p>
        <div
          style={{
            display: "grid",
            gap: "20px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
              backgroundColor: "#fef2f2",
            }}
          >
            <h3 style={{ ...reportStyles.h2, marginTop: 0, marginBottom: "8px", fontSize: "15px" }}>
              하락·부진한 형태 (과열·급등)
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
              <li>
                <strong>A</strong> 뉴스당일 거래량 3배 이상 — 단기(1~7거래일) 평균 수익이 시장보다 낮거나 마이너스에 가깝고, 과거래 직후 조정을 자주 탐.
              </li>
              <li>
                <strong>B</strong> 뉴스당일 갭 2% 이상 + 양봉 — 1~5일 구간에서 평균이 시장보다 약하고, 급등 직후 되돌림 성격.
              </li>
            </ul>
          </div>
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "8px",
              border: "1px solid #bbf7d0",
              backgroundColor: "#f0fdf4",
            }}
          >
            <h3 style={{ ...reportStyles.h2, marginTop: 0, marginBottom: "8px", fontSize: "15px" }}>
              상승·유리한 형태 (건전한 반등)
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
              <li>
                <strong>C</strong> 직전 5거래일 -5% 이상 하락 후, 뉴스당일 양봉 — 단·중기 평균 수익이 시장 평균을 웃돌며 플러스 구간이 이어짐.
              </li>
              <li>
                <strong>D</strong> 당일 거래량 1.5~3배·주가 1~5% 상승 — 과열(A)보다 완만한 동반 상승으로, 같은 구간에서 시장 대비 수익이 크게 나타남.
              </li>
            </ul>
          </div>
        </div>
        <p style={{ margin: 0, lineHeight: 1.65, fontSize: "14px" }}>
          <strong>한 줄 해석:</strong> A·B가 끼면 단기 조정 리스크가 커 <strong>관망</strong> 쪽으로 읽고, C·D 중심이면 <strong>상대적으로 유리</strong>했다. (복합 전략 “추천/관망” 규칙은 기존과 동일: 추천 = C 또는 D이면서 A·B 없음 / 관망 = A 또는 B 포함.)
        </p>
        {strategyPerf?.Baseline &&
          strategyPerf["Strategy A"] &&
          strategyPerf["Strategy B"] &&
          strategyPerf["Strategy C"] &&
          strategyPerf["Strategy D"] && (
          <p style={{ marginTop: "14px", marginBottom: 0, fontSize: "13px", lineHeight: 1.65, color: "#525252" }}>
            현재 JSON 집계 기준 5거래일 평균 수익: 시장 {ret(strategyPerf.Baseline.avg_ret_5d)} — A{" "}
            {ret(strategyPerf["Strategy A"].avg_ret_5d)}, B {ret(strategyPerf["Strategy B"].avg_ret_5d)} / C{" "}
            {ret(strategyPerf["Strategy C"].avg_ret_5d)}, D {ret(strategyPerf["Strategy D"].avg_ret_5d)}.
          </p>
        )}
      </section>

      {/* 4. 전략 포착 사례 (부록) */}
      {advancedData?.strategy_matches && advancedData.strategy_matches.length > 0 && (
        <section style={reportStyles.section}>
          <h2 style={reportStyles.h1}>4. 부록: 전략 포착 사례</h2>
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

      {/* 6. 기사 출간 후 급등 종목 */}
      {topSurgeData && (
        <section style={reportStyles.section}>
          <h2 style={reportStyles.h1}>5. 기사 출간 후 급등 종목 (1d·2d·3d·10d)</h2>
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
