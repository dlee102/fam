"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReportTabs() {
  const pathname = usePathname();
  const isSimple = pathname === "/report/simple";
  const isPresentation = pathname === "/presentation";
  const isDetail = pathname === "/report";

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        backgroundColor: "#f1f5f9",
        borderRadius: "8px",
        padding: "4px",
        border: "1px solid #e2e8f0",
      }}
    >
      <Link
        href="/report/simple"
        style={{
          flex: 1,
          padding: "0.5rem 0.75rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          textAlign: "center",
          borderRadius: "6px",
          textDecoration: "none",
          color: isSimple ? "#0f172a" : "#64748b",
          backgroundColor: isSimple ? "#fff" : "transparent",
          boxShadow: isSimple ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.2s",
        }}
      >
        요약
      </Link>
      <Link
        href="/report"
        style={{
          flex: 1,
          padding: "0.5rem 0.75rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          textAlign: "center",
          borderRadius: "6px",
          textDecoration: "none",
          color: isDetail ? "#0f172a" : "#64748b",
          backgroundColor: isDetail ? "#fff" : "transparent",
          boxShadow: isDetail ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.2s",
        }}
      >
        디테일
      </Link>
      <Link
        href="/presentation"
        style={{
          flex: 1,
          padding: "0.5rem 0.75rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          textAlign: "center",
          borderRadius: "6px",
          textDecoration: "none",
          color: isPresentation ? "#0f172a" : "#64748b",
          backgroundColor: isPresentation ? "#fff" : "transparent",
          boxShadow: isPresentation ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.2s",
        }}
      >
        설명
      </Link>
    </nav>
  );
}
