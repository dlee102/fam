"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, pathMatches, sidebarWorkspace, type NavItem } from "./nav-config";
import { SidebarNavIcon } from "./sidebar-icons";

function splitNavSections(items: NavItem[]): Extract<NavItem, { type: "link" }>[][] {
  const sections: Extract<NavItem, { type: "link" }>[][] = [];
  let cur: Extract<NavItem, { type: "link" }>[] = [];
  for (const item of items) {
    if (item.type === "divider") {
      if (cur.length) sections.push(cur);
      cur = [];
    } else {
      cur.push(item);
    }
  }
  if (cur.length) sections.push(cur);
  return sections;
}

function NavItemNodes({ pathname }: { pathname: string }) {
  return (
    <>
      {navItems.map((item, i) => {
        if (item.type === "divider") {
          return <span key={`d-${i}`} className="nav-tabs__divider" aria-hidden />;
        }
        const isActive = pathMatches(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={isActive}
            className={`nav-tab nav-tab--${item.variant}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function SidebarProfile() {
  const initial = sidebarWorkspace.title.trim().charAt(0).toUpperCase() || "F";
  return (
    <div className="app-sidebar__profile">
      <div className="app-sidebar__avatar" aria-hidden>
        <span className="app-sidebar__avatar-letter">{initial}</span>
      </div>
      <div className="app-sidebar__profile-text">
        <div className="app-sidebar__profile-title">{sidebarWorkspace.title}</div>
        <div className="app-sidebar__profile-sub">{sidebarWorkspace.subtitle}</div>
      </div>
    </div>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  const sections = splitNavSections(navItems);
  return (
    <nav className="app-sidebar__nav app-sidebar__nav--tree" aria-label="섹션">
      {sections.map((section, si) => (
        <div key={si} className="app-sidebar__nav-block">
          {si > 0 ? <div className="app-sidebar__nav-sep" aria-hidden /> : null}
          <div className="app-sidebar__nav-section">
            {section.map((item) => {
              if (item.type !== "link") return null;
              const isActive = pathMatches(pathname, item.href);
              return (
                <div key={item.href} className="app-sidebar__row-wrap">
                  <Link
                    href={item.href}
                    data-active={isActive}
                    className={
                      item.variant === "premium"
                        ? "app-sidebar__row app-sidebar__row--premium"
                        : "app-sidebar__row"
                    }
                    title={item.label}
                  >
                    <span className="app-sidebar__row-icon">
                      <SidebarNavIcon name={item.icon} />
                    </span>
                    <span className="app-sidebar__row-label">{item.label}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** 왼쪽 세로 메뉴 (레이아웃용) */
export function AppSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="app-sidebar" aria-label="섹션 내비게이션">
      <div className="app-sidebar__stack">
        <SidebarProfile />
        <SidebarNav pathname={pathname} />
      </div>
    </aside>
  );
}

/** 상단 가로 탭 (필요 시 레이아웃에서 import) */
export function NavTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="nav-tabs" aria-label="주요 메뉴">
      <NavItemNodes pathname={pathname} />
    </nav>
  );
}
