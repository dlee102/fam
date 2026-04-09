import type { Metadata } from "next";
import { getTickerNamesMap } from "@/lib/ticker-names";
import { MemberPortfolioClient } from "./MemberPortfolioClient";

export const metadata: Metadata = {
  title: "유료회원 포트폴리오 | FAM 뉴스",
  description: "유료회원 전용 포트폴리오",
};

export default function MemberPortfolioPage() {
  const tickerNames = getTickerNamesMap();
  return (
    <main className="news-container news-container--portfolio">
      <MemberPortfolioClient tickerNames={tickerNames} />
    </main>
  );
}
