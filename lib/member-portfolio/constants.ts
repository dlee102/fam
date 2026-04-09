import { getMemberPortfolioRtdbPath } from "@/lib/firebase/member-portfolio-rtdb";
import { FAM_MEMBER_PORTFOLIO_V1 } from "@/lib/member-storage-keys";
import type { PortfolioSyncState } from "./types";

export const PORTFOLIO_LOCAL_STORAGE_KEY = FAM_MEMBER_PORTFOLIO_V1;

export const PORTFOLIO_QUOTES_API = "/api/member-portfolio/quotes";

export type PortfolioTabId = "summary" | "health" | "ratings" | "holdings" | "dividends";

export type PortfolioTabDef = {
  id: PortfolioTabId;
  label: string;
  lockIcon?: boolean;
  /** data-test-id (요약·보유만 SA 호환) */
  testId?: string;
};

export const PORTFOLIO_TABS: readonly PortfolioTabDef[] = [
  { id: "summary", label: "요약", testId: "Summary" },
  { id: "health", label: "헬스 스코어" },
  { id: "ratings", label: "레이팅", lockIcon: true },
  { id: "holdings", label: "보유종목", testId: "Holdings" },
  { id: "dividends", label: "배당" },
] as const;

export function portfolioSyncStatusMessage(state: PortfolioSyncState): string {
  const path = getMemberPortfolioRtdbPath();
  switch (state) {
    case "loading":
      return "동기화 연결 중…";
    case "local":
      return "로컬 저장만 사용 중입니다. `NEXT_PUBLIC_FIREBASE_DATABASE_URL`을 설정하면 전역 동기화됩니다.";
    case "cloud":
      return `Firebase 실시간 동기화 · 경로 ${path} (모든 접속자가 동일 목록을 봅니다)`;
    case "cloud_error":
      return "Firebase에 쓰기 실패했습니다. Realtime Database 보안 규칙에서 읽기/쓰기를 허용했는지 확인하세요.";
    default:
      return "";
  }
}
