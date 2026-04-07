import type { CSSProperties } from "react";

/** 퀀트 대시보드 토큰 — `globals.css`의 `--quant-*`와 연동 (라이트/다크) */
export const sb = {
  canvas: "var(--quant-canvas)",
  surface: "var(--quant-surface)",
  border: "var(--quant-border)",
  rule: "var(--quant-rule)",
  text: "var(--quant-text)",
  muted: "var(--quant-muted)",
  faint: "var(--quant-faint)",
  label: "var(--quant-label)",

  up: "var(--quant-up)",
  down: "var(--quant-down)",

  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-muted)",

  grid: "var(--quant-grid)",

  chartLine: "var(--color-accent)",
  chartLineAlt: "var(--quant-chart-line-alt)",
  refLine: "var(--quant-ref-line)",

  gauge: [
    "var(--quant-gauge-0)",
    "var(--quant-gauge-1)",
    "var(--quant-gauge-2)",
    "var(--quant-gauge-3)",
    "var(--quant-gauge-4)",
  ] as const,
} as const;

/** 카드 내부 소제목 */
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
    tag: "var(--ripple-upstream-tag)",
    tagBg: "var(--ripple-upstream-bg)",
    tagBorder: "var(--ripple-upstream-border)",
  },
  Peer: {
    tag: "var(--ripple-peer-tag)",
    tagBg: "var(--ripple-peer-bg)",
    tagBorder: "var(--ripple-peer-border)",
  },
  Downstream: {
    tag: "var(--ripple-downstream-tag)",
    tagBg: "var(--ripple-downstream-bg)",
    tagBorder: "var(--ripple-downstream-border)",
  },
};
