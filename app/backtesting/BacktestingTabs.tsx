"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pathMatches } from "@/lib/path-match";
import { BACKTESTING_SUBTABS } from "./lib/backtesting-routes";

export function BacktestingTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="backtesting-tabs-wrap" role="navigation" aria-label="백테스팅 하위 메뉴">
      <nav className="nav-tabs backtesting-tabs">
        {BACKTESTING_SUBTABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="nav-tab nav-tab--backtest"
            data-active={pathMatches(pathname, t.href)}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
