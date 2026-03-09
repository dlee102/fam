"use client";

import { useEffect, useState } from "react";
import { AIScoreProgress, QuantRatingBar } from "../ReportCharts";

const QUANT_INDICATOR = { 단기: "매수", 중기: "보유", 장기: "매수" } as const;
const RISK_LEVEL = 14;
const RELATED_STOCKS = [
  { symbol: "KWR", name: "퀘이커케미칼", change: -0.74 },
  { symbol: "NGVT", name: "인제비티", change: 2.14 },
  { symbol: "ASH", name: "애쉬랜드", change: 0.14 },
];

function Line({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", padding: "0.375rem 0" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? "#1a1a1a" }}>{value}</span>
    </div>
  );
}

interface ReportContentSimpleProps {
  symbol?: string;
  date?: string;
}

export function ReportContentSimple({ symbol, date }: ReportContentSimpleProps) {
  const [techTotal, setTechTotal] = useState(85);

  useEffect(() => {
    if (!symbol || !date) return;
    fetch(`/api/quant/scores?date=${date}&symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        const mom = d.momentum ?? 86;
        const trend = d.trend ?? 87;
        const spread = d.spread ?? 89;
        const vol = d.volume ?? 75;
        setTechTotal(Math.round((mom * 30 + trend * 30 + spread * 20 + vol * 20) / 100));
      })
      .catch(() => {});
  }, [symbol, date]);

  const getSignalColor = (s: string) =>
    s === "매수" ? "#059669" : s === "매도" ? "#dc2626" : "#737373";

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: "8px",
        padding: "1rem 1.25rem",
      }}
    >
      {/* AI 종합 점수 */}
      <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.25rem" }}>AI 종합 점수</div>
        <AIScoreProgress score={80} />
      </div>

      {/* Quant Rating */}
      <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.25rem" }}>Quant Rating</div>
        <QuantRatingBar rating={4} score={3.56} compact />
      </div>

      {/* 핵심 지표 */}
      <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
        <Line label="위험도" value={`${RISK_LEVEL}% 양호`} color="#059669" />
        <Line label="발행일 수익률" value="+8.5%" color="#059669" />
      </div>

      {/* 퀀트 시그널 */}
      <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.5rem" }}>퀀트 시그널</div>
        <div style={{ display: "flex", gap: "1rem" }}>
          {Object.entries(QUANT_INDICATOR).map(([term, signal]) => (
            <span key={term} style={{ fontSize: "0.8125rem" }}>
              <span style={{ color: "#6b7280" }}>{term}</span>{" "}
              <span style={{ fontWeight: 600, color: getSignalColor(signal) }}>{signal}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 기술 점수 & 백테스트 */}
      <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
        <Line label="기술 점수" value={`${techTotal}점`} color={techTotal >= 80 ? "#059669" : techTotal >= 60 ? "#d97706" : "#dc2626"} />
        <Line label="유사 기사 평균 수익률" value="+3.8%" color="#2563eb" />
      </div>

      {/* 연관 종목 (상위 3개) */}
      <div>
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.5rem" }}>연관 종목</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {RELATED_STOCKS.map((s) => (
            <div key={s.symbol} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span style={{ fontWeight: 500 }}>{s.symbol}</span>
              <span style={{ fontWeight: 600, color: s.change >= 0 ? "#059669" : "#dc2626" }}>
                {s.change >= 0 ? "+" : ""}{s.change}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
