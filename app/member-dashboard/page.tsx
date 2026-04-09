import type { Metadata } from "next";
import Link from "next/link";
import { getMemberDashboardStatic } from "@/lib/member-dashboard-static";
import { MemberDashboardClient } from "./MemberDashboardClient";

export const metadata: Metadata = {
  title: "유료회원 전용 대시보드 | FAM 뉴스",
  description: "기사 종목 발행 후 누적 순위·AI 퀀트 점수, 관심종목(로컬 저장)",
};

export default function MemberDashboardPage() {
  const { rankings, generated_at } = getMemberDashboardStatic();

  return (
    <main className="news-container member-dashboard">
      <MemberDashboardClient rankings={rankings} snapshotAt={generated_at} />
      <p className="member-dashboard__footer">
        <Link href="/" className="article-link">
          ← 뉴스 목록
        </Link>
      </p>
    </main>
  );
}
