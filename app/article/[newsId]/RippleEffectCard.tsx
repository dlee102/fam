"use client";

import { sb, qLabel, rippleStyle, type RippleType } from "./sidebar-tokens";

const RIPPLE_DATA = [
  { name: "삼성전자", relation: "주요 고객사", score: 88, type: "Upstream" as const },
  { name: "SK하이닉스", relation: "경쟁사 동향", score: 72, type: "Peer" as const },
  { name: "솔브레인", relation: "소재 공급망", score: 94, type: "Downstream" as const },
  { name: "리노공업", relation: "검사 소켓", score: 65, type: "Downstream" as const },
];

export function RippleEffectCard() {
  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div style={{ ...qLabel, marginBottom: "0.25rem" }}>공급망 · 동종</div>
      <p style={{ fontSize: "0.75rem", color: sb.faint, margin: "0 0 1rem", lineHeight: 1.45 }}>
        Ripple 전이 스냅샷
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {RIPPLE_DATA.map((item) => {
          const rs = rippleStyle[item.type as RippleType];
          return (
            <div
              key={item.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.65rem 0.75rem",
                borderRadius: 12,
                backgroundColor: sb.canvas,
                border: `1px solid ${sb.border}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: sb.text }}>{item.name}</span>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      color: rs.tag,
                      backgroundColor: rs.tagBg,
                      border: `1px solid ${rs.tagBorder}`,
                      padding: "2px 7px",
                      borderRadius: 6,
                      lineHeight: 1,
                    }}
                  >
                    {item.type}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: sb.muted, marginTop: "0.2rem" }}>{item.relation}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "0.625rem", color: sb.faint, fontWeight: 500 }}>점수</div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: sb.text }}>{item.score}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
