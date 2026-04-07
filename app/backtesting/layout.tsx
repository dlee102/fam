import type { Metadata } from "next";
import { BacktestingTabs } from "./BacktestingTabs";

export const metadata: Metadata = {
  title: "백테스팅 | FAM",
  description: "EODHD 매니페스트 및 발행일 기준 수익률 통계",
};

export default function BacktestingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="backtesting-layout">
      <BacktestingTabs />
      {children}
    </div>
  );
}
