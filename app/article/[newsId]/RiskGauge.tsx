"use client";

import dynamic from "next/dynamic";

const GaugeChart = dynamic(() => import("react-gauge-chart"), { ssr: false });

export function RiskGauge({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const percent = clamped / 100;

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
          color: "#525252",
        }}
      >
        위험도
      </div>
      <GaugeChart
        id="risk-gauge"
        nrOfLevels={20}
        percent={percent}
        colors={["#059669", "#d97706", "#dc2626"]}
        arcWidth={0.25}
        arcPadding={0.02}
        cornerRadius={2}
        needleColor="#374151"
        needleBaseColor="#374151"
        textColor="#1a1a1a"
        formatTextValue={(val) => {
          const num = parseFloat(val);
          const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
          return `${pct}%`;
        }}
        style={{ height: 120 }}
      />
      <div
        style={{
          textAlign: "center",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#059669",
          marginTop: "-0.75rem",
          marginBottom: "0.25rem",
        }}
      >
        양호
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6875rem",
          color: "#9ca3af",
          paddingLeft: "4px",
          paddingRight: "4px",
        }}
      >
        <span>낮음</span>
        <span>높음</span>
      </div>
    </div>
  );
}
