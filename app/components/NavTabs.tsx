"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/sentiment", label: "뉴스+티커" },
  { href: "/stats", label: "기본 통계" },
  { href: "/report", label: "종합 보고서" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="nav-tabs"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem",
        backgroundColor: "var(--color-bg)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
      }}
    >
      {tabs.map(({ href, label }) => {
        const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            data-active={isActive}
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: isActive ? "#fff" : "var(--color-text-muted)",
              backgroundColor: isActive ? "var(--color-accent)" : "transparent",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
            className="nav-tab"
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
