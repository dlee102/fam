import { ReportContent } from "./ReportContent";

export const metadata = {
  title: "AI 인텔리전스 종합 보고서 | FAM",
  description: "퀀트 인텔리전스 지표 및 기술적 분석 종합 보고서",
};

export default function ReportPage() {
  return (
    <>
      <header
        style={{
          borderBottom: "2px solid var(--color-accent)",
          paddingBottom: "1rem",
          marginBottom: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "var(--color-text)",
          }}
        >
          AI 인텔리전스 종합 보고서
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <ReportContent symbol="KR7000020008" date="20240102" />
    </>
  );
}
