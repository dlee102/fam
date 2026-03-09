import Link from "next/link";
import { ReportTabs } from "./ReportTabs";

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        paddingTop: "1.5rem",
        paddingBottom: "3rem",
        maxWidth: 720,
        margin: "0 auto",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <Link href="/" style={{ fontSize: "0.875rem", color: "#737373" }}>
          ← 목록으로
        </Link>
        <div style={{ minWidth: 220 }}>
          <ReportTabs />
        </div>
      </div>
      {children}
    </div>
  );
}
