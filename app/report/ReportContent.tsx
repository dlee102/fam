"use client";

import { useEffect, useId, useState } from "react";
import {
  BacktestLineChart,
  TechScoreRadarChart,
  ReturnLineChart,
  RippleBarChart,
  RelatedStocksBarChart,
  AIScoreProgress,
  QuantRatingBar,
  FactorGradesTable,
} from "./ReportCharts";
import { REPORT_PRESENTER_HELP, type ReportPresenterSectionId } from "./reportPresenterHelp";

const QUANT_INDICATOR = { 단기: "매수", 중기: "보유", 장기: "매수" } as const;
const RISK_LEVEL = 14;
const RELATED_STOCKS = [
  { symbol: "KWR", name: "퀘이커케미칼", price: 147.03, change: -0.74 },
  { symbol: "NGVT", name: "인제비티", price: 72.03, change: 2.14 },
  { symbol: "ASH", name: "애쉬랜드", price: 62.36, change: 0.14 },
  { symbol: "MTX", name: "미네랄테크놀로지", price: 70.62, change: -0.66 },
  { symbol: "IOSP", name: "이노스펙", price: 76.58, change: -1.29 },
];
const RIPPLE_DATA = [
  { name: "삼성전자", relation: "주요 고객사", score: 88, type: "Upstream" },
  { name: "SK하이닉스", relation: "경쟁사 동향", score: 72, type: "Peer" },
  { name: "솔브레인", relation: "소재 공급망", score: 94, type: "Downstream" },
  { name: "리노공업", relation: "검사 소켓", score: 65, type: "Downstream" },
];
const BACKTEST_DAYS = ["발행일", "D+1", "D+2", "D+3", "D+4", "D+5"];
const BACKTEST_VALUES = [0, 1.2, 0.8, 2.5, 4.1, 3.8];
const AVG_RETURN = 3.8;

function ReportLine({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.5rem 0",
        borderBottom: "1px solid #f0f0f0",
        fontSize: "0.9375rem",
      }}
    >
      <span style={{ color: "#525252", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: valueColor ?? "#1a1a1a",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ReportSection({
  sectionId,
  title,
  subtitle,
  children,
}: {
  sectionId?: ReportPresenterSectionId;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpPanelId = useId();
  const helpBlocks = sectionId ? REPORT_PRESENTER_HELP[sectionId] : null;

  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid #e5e5e5",
          marginBottom: subtitle ? "0.25rem" : helpOpen && helpBlocks ? "0.5rem" : "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "#1a1a1a",
            margin: 0,
            flex: 1,
            minWidth: 0,
            lineHeight: 1.45,
          }}
        >
          {title}
        </h2>
        {helpBlocks && (
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-controls={helpPanelId}
            title="발표자용 설명"
            onClick={() => setHelpOpen((o) => !o)}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "1px solid #d4d4d4",
              background: helpOpen ? "#f3f4f6" : "#fafafa",
              color: "#525252",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ?
          </button>
        )}
      </div>
      {subtitle && (
        <p style={{ fontSize: "0.8125rem", color: "#737373", margin: "0 0 1rem" }}>
          {subtitle}
        </p>
      )}
      {helpOpen && helpBlocks && (
        <div
          id={helpPanelId}
          role="region"
          aria-label="발표자용 설명"
          style={{
            margin: "0 0 1rem",
            padding: "0.875rem 1rem",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            lineHeight: 1.65,
            color: "#422006",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#b45309",
              marginBottom: "0.5rem",
            }}
          >
            발표자용 · 점수·등급 기준
          </div>
          {helpBlocks.map((para, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : "0.5rem 0 0" }}>
              {para}
            </p>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

interface ReportContentProps {
  symbol?: string;
  date?: string;
}

export function ReportContent({ symbol, date }: ReportContentProps) {
  const [techScores, setTechScores] = useState({
    momentum: 86,
    trend: 87,
    liquidity: 89,
    volume: 75,
    total: 85,
  });
  const [loadingTech, setLoadingTech] = useState(false);

  useEffect(() => {
    if (!symbol || !date) return;
    setLoadingTech(true);
    fetch(`/api/quant/scores?date=${date}&symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        const mom = d.momentum ?? 86;
        const trend = d.trend ?? 87;
        const spread = d.spread ?? 89;
        const vol = d.volume ?? 75;
        setTechScores({
          momentum: Math.round(mom),
          trend: Math.round(trend),
          liquidity: Math.round(spread),
          volume: Math.round(vol),
          total: Math.round((mom * 30 + trend * 30 + spread * 20 + vol * 20) / 100),
        });
      })
      .catch(() => {})
      .finally(() => setLoadingTech(false));
  }, [symbol, date]);

  const getSignalColor = (s: string) =>
    s === "매수" ? "#059669" : s === "매도" ? "#dc2626" : "#737373";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* AI 인텔리전스 종합 점수 */}
      <ReportSection sectionId="ai-total" title="AI 인텔리전스 종합 점수">
        <AIScoreProgress score={80} />
      </ReportSection>

      {/* Quant Rating (Seeking Alpha 스타일) */}
      <ReportSection
        sectionId="quant-rating"
        title="Quant Rating"
        subtitle="1 Strong Sell ~ 5 Strong Buy · 퀀트 팩터 종합 등급"
      >
        <QuantRatingBar rating={4} score={3.56} />
      </ReportSection>

      {/* 팩터 등급 */}
      <ReportSection
        sectionId="factor-grades"
        title="팩터 등급"
        subtitle="밸류에이션, 성장성, 수익성, 모멘텀, 리비전"
      >
        <FactorGradesTable
          grades={[
            { factor: "밸류에이션", now: "C+", m3: "C", m6: "C-" },
            { factor: "성장성", now: "B", m3: "A+", m6: "A+" },
            { factor: "수익성", now: "C", m3: "C", m6: "C" },
            { factor: "모멘텀", now: "B", m3: "B", m6: "B" },
            { factor: "리비전", now: "B+", m3: "B", m6: "B-" },
          ]}
        />
      </ReportSection>

      {/* 퀀트 인텔리전스 지표 */}
      <ReportSection sectionId="quant-indicator" title="퀀트 인텔리전스 지표">
        {Object.entries(QUANT_INDICATOR).map(([term, signal]) => (
          <ReportLine
            key={term}
            label={term}
            value={signal}
            valueColor={getSignalColor(signal)}
          />
        ))}
      </ReportSection>

      {/* 위험도 */}
      <ReportSection sectionId="risk" title="위험도">
        <ReportLine label="위험 수준" value={`${RISK_LEVEL}%`} valueColor="#059669" />
        <ReportLine label="평가" value="양호" valueColor="#059669" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "#9ca3af",
            marginTop: "0.5rem",
            padding: "0 0.25rem",
          }}
        >
          <span>낮음</span>
          <span>높음</span>
        </div>
      </ReportSection>

      {/* 발행일 기준 수익률 */}
      <ReportSection sectionId="publish-return" title="발행일 기준 수익률" subtitle="기준일: 2025.02.01">
        <ReturnLineChart returnRate={8.5} />
      </ReportSection>

      {/* 기술적 지표 분석 */}
      <ReportSection
        sectionId="technical"
        title="기술적 지표 분석"
        subtitle={`2d / 5d / 10d — Momentum Score ${techScores.total}점 ${loadingTech ? "(조회중)" : ""}`}
      >
        <TechScoreRadarChart
          data={[
            { subject: "모멘텀", score: techScores.momentum, fullMark: 100 },
            { subject: "추세", score: techScores.trend, fullMark: 100 },
            { subject: "유동성", score: techScores.liquidity, fullMark: 100 },
            { subject: "거래량", score: techScores.volume, fullMark: 100 },
          ]}
        />
      </ReportSection>

      {/* 과거 유사 기사 백테스트 */}
      <ReportSection
        sectionId="backtest"
        title="과거 유사 기사 백테스트"
        subtitle="유사 호재 발생 후 5일간 흐름"
      >
        <BacktestLineChart
          data={BACKTEST_DAYS.map((day, i) => ({
            day,
            value: BACKTEST_VALUES[i],
          }))}
          avgReturn={AVG_RETURN}
        />
      </ReportSection>

      {/* 섹터 전이 효과 */}
      <ReportSection
        sectionId="ripple"
        title="섹터 전이 효과 (Ripple Effect)"
        subtitle="공급망 및 경쟁사 퀀트 점수 분석"
      >
        <RippleBarChart
          data={RIPPLE_DATA.map((item) => ({
            name: item.name,
            score: item.score,
            type: item.type,
          }))}
        />
      </ReportSection>

      {/* 연관 종목 순위 */}
      <ReportSection sectionId="related" title="연관 종목 순위">
        <RelatedStocksBarChart
          data={RELATED_STOCKS.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            change: s.change,
          }))}
        />
        <div
          style={{
            marginTop: "1rem",
            border: "1px solid #e5e5e5",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#fafafa" }}>
                <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#525252", borderBottom: "1px solid #e5e5e5" }}>
                  종목
                </th>
                <th style={{ textAlign: "right", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#525252", borderBottom: "1px solid #e5e5e5" }}>
                  최종가
                </th>
                <th style={{ textAlign: "right", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#525252", borderBottom: "1px solid #e5e5e5" }}>
                  등락률
                </th>
              </tr>
            </thead>
            <tbody>
              {RELATED_STOCKS.map((stock) => (
                <tr key={stock.symbol} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <div style={{ fontWeight: 600, color: "#1a1a1a" }}>{stock.symbol}</div>
                    <div style={{ fontSize: "0.75rem", color: "#737373" }}>{stock.name}</div>
                  </td>
                  <td style={{ textAlign: "right", padding: "0.625rem 0.75rem", color: "#404040" }}>
                    {stock.price.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.625rem 0.75rem", fontWeight: 600, color: stock.change >= 0 ? "#059669" : "#dc2626" }}>
                    {stock.change >= 0 ? "+" : ""}{stock.change}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>
    </div>
  );
}
