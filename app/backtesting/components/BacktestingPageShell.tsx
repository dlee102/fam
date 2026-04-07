import type { ReactNode } from "react";
import { backtestingPageShell } from "../lib/ui-styles";

type Props = {
  title: string;
  description?: ReactNode;
  /** manifest 페이지는 헤더 여백을 조금 더 씀 */
  headerMarginBottom?: string;
  children: ReactNode;
};

export function BacktestingPageShell({
  title,
  description,
  headerMarginBottom = "1.5rem",
  children,
}: Props) {
  return (
    <div style={backtestingPageShell}>
      <header style={{ marginBottom: headerMarginBottom }}>
        <h1
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {description ? (
          <div
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
              lineHeight: 1.55,
            }}
          >
            {description}
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
