"use client";

import dynamic from "next/dynamic";
import { sb, qLabel } from "./sidebar-tokens";

const GaugeChart = dynamic(() => import("react-gauge-chart"), { ssr: false });

export function RiskGauge({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const percent = clamped / 100;
  const band =
    clamped < 33 ? "낮음" : clamped < 66 ? "보통" : "높음";
  const bandColor =
    clamped < 33 ? "#047857" : clamped < 66 ? "#b45309" : "#c2410c";

  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div style={{ ...qLabel, marginBottom: "0.5rem" }}>위험도</div>
      <GaugeChart
        id="risk-gauge"
        nrOfLevels={15}
        percent={percent}
        colors={[...sb.gauge]}
        arcWidth={0.22}
        arcPadding={0.01}
        cornerRadius={1}
        needleColor="#0f172a"
        needleBaseColor="#0f172a"
        textColor={sb.text}
        formatTextValue={(val) => {
          const num = parseFloat(val);
          const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
          return `${pct}%`;
        }}
        style={{ height: 108 }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "-0.35rem",
          fontSize: "0.75rem",
          color: sb.muted,
        }}
      >
        <span>
          구간 <span style={{ fontWeight: 600, color: bandColor }}>{band}</span>
        </span>
        <span style={{ color: sb.faint }}>0 — 100</span>
      </div>
    </section>
  );
}
