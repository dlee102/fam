import type { Metadata } from "next";
import { BacktestingPageShell } from "../components/BacktestingPageShell";
import { backtestingPanelCard } from "../lib/ui-styles";
import { PerArticleManifestPanel } from "../PerArticleManifestPanel";
import { loadPerArticleManifest } from "../per-article-manifest";

export const metadata: Metadata = {
  title: "매니페스트 · 캐시 | 백테스팅",
  description: "Per-article EODHD 뉴스 윈도 매니페스트 및 캐시 적재 현황",
};

export default function BacktestingManifestPage() {
  const { rows, summary, relativePath } = loadPerArticleManifest();

  return (
    <BacktestingPageShell
      title="매니페스트 · 캐시"
      headerMarginBottom="28px"
      description={
        <>
          EODHD per-article 파이프라인의{" "}
          <strong style={{ color: "var(--color-text)" }}>manifest_per_article.json</strong> 기준
          일봉·5분봉 캐시 적재 현황입니다.
        </>
      }
    >
      <section style={backtestingPanelCard}>
        <PerArticleManifestPanel rows={rows} summary={summary} relativePath={relativePath} />
      </section>
    </BacktestingPageShell>
  );
}
