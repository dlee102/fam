import type { CSSProperties } from "react";

/** 백테스팅 하위 페이지 공통 폭·패딩 */
export const backtestingPageShell: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "12px 24px 40px",
  minHeight: "50vh",
};

/** 카드형 섹션 (매니페스트 패널·통계 패널 공통) */
export const backtestingPanelCard: CSSProperties = {
  padding: "1.25rem 1.35rem",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--color-border-subtle)",
  backgroundColor: "var(--color-surface)",
  boxShadow: "var(--shadow-sm)",
};
