export type NavTabVariant = "default" | "news" | "stats" | "report" | "backtest";

export type NavIcon = "home" | "chart" | "news" | "stats" | "document" | "flask";

export type NavItem =
  | { type: "link"; href: string; label: string; variant: NavTabVariant; icon: NavIcon }
  | { type: "divider" };

export const navItems: NavItem[] = [
  { type: "link", href: "/", label: "1번~6번", variant: "default", icon: "home" },
  {
    type: "link",
    href: "/kiwoom-robo-market",
    label: "키움 로보마켓",
    variant: "default",
    icon: "chart",
  },
  { type: "divider" },
  { type: "link", href: "/sentiment", label: "뉴스+티커", variant: "news", icon: "news" },
  { type: "link", href: "/stats", label: "기본 통계", variant: "stats", icon: "stats" },
  { type: "link", href: "/report", label: "종합 보고서", variant: "report", icon: "document" },
  { type: "link", href: "/backtesting", label: "백테스팅", variant: "backtest", icon: "flask" },
];

/** 사이드바 상단 프로필 영역 (레퍼런스의 workspace 블록) */
export const sidebarWorkspace = {
  title: "Qraft AI",
  subtitle: "FAM 뉴스",
} as const;

/** 사이드바 하단 CTA */
export const sidebarFooterCta = {
  href: "/report",
  label: "종합 보고서 열기",
} as const;

export { pathMatches } from "@/lib/path-match";
