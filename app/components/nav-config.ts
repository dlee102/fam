export type NavTabVariant = "default" | "news" | "premium";

export type NavIcon =
  | "home"
  | "chart"
  | "news"
  | "premium"
  | "portfolio";

export type NavItem =
  | { type: "link"; href: string; label: string; variant: NavTabVariant; icon: NavIcon }
  | { type: "divider" };

export const navItems: NavItem[] = [
  {
    type: "link",
    href: "/",
    label: "퀀트 인사이트",
    variant: "default",
    icon: "home",
  },
  {
    type: "link",
    href: "/kiwoom-robo-market",
    label: "키움 로보마켓",
    variant: "default",
    icon: "chart",
  },
  { type: "divider" },
  {
    type: "link",
    href: "/member-dashboard",
    label: "유료회원 전용 대시보드",
    variant: "premium",
    icon: "premium",
  },
  {
    type: "link",
    href: "/member-portfolio",
    label: "유료회원 포트폴리오",
    variant: "premium",
    icon: "portfolio",
  },
];

/** 사이드바 상단 프로필 영역 (레퍼런스의 workspace 블록) */
export const sidebarWorkspace = {
  title: "Qraft AI",
  subtitle: "FAM 뉴스",
} as const;

export { pathMatches } from "@/lib/path-match";
