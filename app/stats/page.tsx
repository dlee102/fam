import { redirect } from "next/navigation";

/** 이전 `/stats` 보고서 경로 — 탭·페이지 제거 후 홈으로 보냄 */
export default function StatsRedirectPage() {
  redirect("/");
}
