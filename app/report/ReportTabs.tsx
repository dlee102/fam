"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReportTabs() {
  const pathname = usePathname();
  const isSimple = pathname === "/report/simple";

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        padding: "4px",
        border: "1px solid #e5e7eb",
      }}
    >
      <Link
        href="/report/simple"
        style={{
          flex: 1,
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "center",
          borderRadius: "6px",
          textDecoration: "none",
          color: isSimple ? "#1a1a1a" : "#6b7280",
          backgroundColor: isSimple ? "#fff" : "transparent",
          boxShadow: isSimple ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          transition: "all 0.2s",
        }}
      >
        요약
      </Link>
      <Link
        href="/report"
        style={{
          flex: 1,
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "center",
          borderRadius: "6px",
          textDecoration: "none",
          color: !isSimple ? "#1a1a1a" : "#6b7280",
          backgroundColor: !isSimple ? "#fff" : "transparent",
          boxShadow: !isSimple ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          transition: "all 0.2s",
        }}
      >
        디테일
      </Link>
    </nav>
  );
}
