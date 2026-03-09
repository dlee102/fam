import { ReportContentSimple } from "./ReportContentSimple";

export const metadata = {
  title: "AI 인텔리전스 요약 | FAM",
  description: "퀀트 인텔리전스 핵심 지표 요약",
};

export default function ReportSimplePage() {
  return (
    <>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          AI 인텔리전스 요약
        </h1>
        <p style={{ fontSize: "0.75rem", color: "#737373", marginTop: "0.25rem" }}>
          {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
        </p>
      </header>

      <ReportContentSimple symbol="KR7000020008" date="20240102" />
    </>
  );
}
