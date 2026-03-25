"use client";

import { sb, qLabel } from "./sidebar-tokens";

export function AIScoreGauge({ score = 80 }: { score?: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const label =
    clamped >= 70 ? "상위" : clamped >= 40 ? "중간" : "하위";

  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div style={{ ...qLabel, marginBottom: "0.625rem" }}>AI 종합 점수</div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            fontSize: "2rem",
            fontWeight: 600,
            color: sb.text,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {clamped}
        </span>
        <span style={{ fontSize: "0.75rem", color: sb.muted, fontWeight: 500 }}>
          / 100 · <span style={{ color: sb.text }}>{label}</span>
        </span>
      </div>
      <div
        style={{
          height: "6px",
          backgroundColor: sb.grid,
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${sb.accent} 0%, #14b8a6 100%)`,
            borderRadius: 9999,
            transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </section>
  );
}
