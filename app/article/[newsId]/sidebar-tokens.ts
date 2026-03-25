import type { CSSProperties } from "react";

/** 퀀트 대시보드 — 슬레이트 베이스, 단일 틸 악센트 (트렌디·전문 톤) */
export const sb = {
  canvas: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  rule: "rgba(15, 23, 42, 0.06)",
  text: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  label: "#475569",

  up: "#047857",
  down: "#be123c",

  accent: "#0d9488",
  accentSoft: "#ccfbf1",

  grid: "#f1f5f9",

  chartLine: "#0d9488",
  chartLineAlt: "#2563eb",
  refLine: "#cbd5e1",

  gauge: ["#16a34a", "#65a30d", "#ca8a04", "#ea580c", "#dc2626"] as const,
} as const;

/** 카드 내부 소제목 (대문자 금지, 읽기형 라벨) */
export const qLabel: CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
  color: sb.label,
};

export type RippleType = "Upstream" | "Peer" | "Downstream";

export const rippleStyle: Record<
  RippleType,
  { tag: string; tagBg: string; tagBorder: string }
> = {
  Upstream: {
    tag: "#134e4a",
    tagBg: "#f0fdfa",
    tagBorder: "#99f6e4",
  },
  Peer: {
    tag: "#334155",
    tagBg: "#f8fafc",
    tagBorder: "#e2e8f0",
  },
  Downstream: {
    tag: "#1e3a8a",
    tagBg: "#eff6ff",
    tagBorder: "#bfdbfe",
  },
};
