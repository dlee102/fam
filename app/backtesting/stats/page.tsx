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
  description: "발행일(T0) 이후 거래일 N일 보유 시 표본 평균 수익률",
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
          <strong style={{ color: "var(--color-text)" }}>발행일 다음 거래일부터 N일 보유</strong>할 때의
          표본 평균 수익률입니다. 시나리오 A~F는 진입 규칙이 다릅니다(F는 공개 시각 직후 첫 5분봉 종가) — 차트에서 겹쳐 비교하세요.
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
