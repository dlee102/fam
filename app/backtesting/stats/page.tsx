import type { Metadata } from "next";
import { BacktestingPageShell } from "../components/BacktestingPageShell";

/** 로컬 JSON 갱신 후에도 손익분해·티커 귀속 필드가 바로 반영되도록 */
export const dynamic = "force-dynamic";
import { loadBacktestingSourceCounts } from "../lib/backtesting-source-counts.load";
import { loadPublishHorizon } from "../lib/publish-horizon.load";
import { hasPublishHorizonData } from "../lib/publish-horizon.types";
import { PublishHorizonChart } from "./PublishHorizonChart";
import { StatsEmptyState } from "./StatsEmptyState";

export const metadata: Metadata = {
  title: "기본 통계 | 백테스팅",
  description: "발행일 기준 거래일 N일 보유 평균 수익률·승률 (1~30일, 진입 5종 비교)",
};

export default function BacktestingStatsPage() {
  const data = loadPublishHorizon();
  const hasData = hasPublishHorizonData(data);
  const sourceCounts = loadBacktestingSourceCounts();

  return (
    <BacktestingPageShell
      title="기본 통계"
      description={
        <>
          기사 발행일(T0) 이후{" "}
          <strong style={{ color: "var(--color-text)" }}>거래일 1~30일</strong> 구간별 표본 평균
          수익률·승률입니다. 진입 방식 A~E를 토글해 비교할 수 있습니다.
        </>
      }
    >
      {!hasData || !data ? (
        <StatsEmptyState />
      ) : (
        <PublishHorizonChart data={data} sourceCounts={sourceCounts} />
      )}
    </BacktestingPageShell>
  );
}
