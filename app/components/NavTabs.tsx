"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabVariant = "default" | "news" | "stats" | "report";

type TabItem =
  | { type: "link"; href: string; label: string; variant: TabVariant }
  | { type: "divider" };

const tabs: TabItem[] = [
  { type: "link", href: "/", label: "1번~6번", variant: "default" },
  { type: "link", href: "/kiwoom-robo-market", label: "키움 로보마켓", variant: "default" },
  { type: "divider" },
  { type: "link", href: "/sentiment", label: "뉴스+티커", variant: "news" },
  { type: "link", href: "/stats", label: "기본 통계", variant: "stats" },
  { type: "link", href: "/report", label: "종합 보고서", variant: "report" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="nav-tabs" aria-label="주요 메뉴">
      {tabs.map((item, i) => {
        if (item.type === "divider") {
          return (
            <span
              key={`divider-${i}`}
              className="nav-tabs__divider"
              aria-hidden
            />
          );
        }
        const { href, label, variant } = item;
        const isActive =
          pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={`${href}-${label}`}
            href={href}
            data-active={isActive}
            className={`nav-tab nav-tab--${variant}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
