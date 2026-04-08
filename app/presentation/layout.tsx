import type { ReactNode } from "react";

export const metadata = {
  title: "AI 인텔리전스 발표 | FAM",
  description: "FAM 인사이트 발표 — 전체화면 슬라이드",
};

/** 루트 레이아웃 헤더 위에 페이지가 올라가므로 여기서는 래퍼만 최소화 */
export default function PresentationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
