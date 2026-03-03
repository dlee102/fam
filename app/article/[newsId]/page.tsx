import Link from "next/link";
import { fetchArticleContent } from "@/lib/crawl-article";
import { AIScoreGauge } from "./AIScoreGauge";
import { RiskGauge } from "./RiskGauge";
import { ReturnChartCard } from "./ReturnChartCard";
import { TechnicalScoreCard } from "./TechnicalScoreCard";
import { BacktestChartCard } from "./BacktestChartCard";
import { SupplyDemandCard } from "./SupplyDemandCard";
import { RippleEffectCard } from "./RippleEffectCard";

const QUANT_INDICATOR_DUMMY = {
  단기: "매수",
  중기: "보유",
  장기: "매수",
} as const;

const RISK_LEVEL_DUMMY = 14; // 0~100 (낮음~높음)

const RELATED_STOCKS_DUMMY = [
  { symbol: "KWR", name: "퀘이커케미칼", price: 147.03, change: -0.74 },
  { symbol: "NGVT", name: "인제비티", price: 72.03, change: 2.14 },
  { symbol: "ASH", name: "애쉬랜드", price: 62.36, change: 0.14 },
  { symbol: "MTX", name: "미네랄테크놀로지", price: 70.62, change: -0.66 },
  { symbol: "IOSP", name: "이노스펙", price: 76.58, change: -1.29 },
];

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ newsId: string }>;
}) {
  const { newsId } = await params;
  const article = await fetchArticleContent(newsId);

  if (!article) {
    return (
      <main className="news-container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <p style={{ color: "#737373" }}>기사를 불러올 수 없습니다.</p>
        <Link href="/" style={{ color: "#2563eb", marginTop: "1rem", display: "inline-block" }}>
          ← 목록으로
        </Link>
      </main>
    );
  }

  return (
    <main className="article-page-layout" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <Link
        href="/"
        style={{
          fontSize: "0.875rem",
          color: "#737373",
          marginBottom: "1.5rem",
          display: "inline-block",
        }}
      >
        ← 목록으로
      </Link>

      <div className="article-with-sidebar" style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        <article style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: "1rem",
          }}
        >
          {article.title}
        </h1>
        {article.subtitle && (
          <p style={{ fontSize: "1rem", color: "#525252", marginBottom: "0.5rem" }}>
            {article.subtitle}
          </p>
        )}
        {article.date && (
          <time style={{ fontSize: "0.875rem", color: "#737373", display: "block", marginBottom: "1.5rem" }}>
            {article.date}
          </time>
        )}
        <div
          className="article-body"
          style={{
            fontSize: "1.25rem",
            lineHeight: 1.9,
            color: "#404040",
          }}
        >
          {(article.bodyBlocks?.length ? article.bodyBlocks : article.body.split(/\n\n+/).filter((p) => p.trim()).map((c) => ({ type: "text" as const, content: c }))).flatMap((block, i) =>
            block.type === "text"
              ? block.content.split(/\n\n+/).filter((p) => p.trim()).map((para, j) => (
                  <p key={`${i}-${j}`} style={{ marginBottom: "1.5rem", marginTop: 0 }}>
                    {para.trim()}
                  </p>
                ))
              : [
                  <figure key={i} style={{ margin: "2rem 0", textAlign: "center" }}>
                    <img
                      src={block.image.src}
                      alt={block.image.caption || ""}
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        borderRadius: "8px",
                      }}
                    />
                    {block.image.caption && (
                      <figcaption
                        style={{
                          fontSize: "0.875rem",
                          color: "#737373",
                          marginTop: "0.5rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {block.image.caption}
                      </figcaption>
                    )}
                  </figure>,
                ]
          )}
        </div>
      </article>

      <aside
        className="quant-indicator-sidebar"
        style={{
          width: "300px",
          flexShrink: 0,
          padding: "1.25rem",
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e5e5",
          position: "sticky",
          top: "1rem",
        }}
      >
        <AIScoreGauge score={80} />
        <h3
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            marginBottom: "1rem",
            color: "#1a1a1a",
          }}
        >
          퀀트 인텔리전스 지표
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {Object.entries(QUANT_INDICATOR_DUMMY).map(
            ([term, signal]) => (
              <div
                key={term}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ color: "#525252" }}>{term}</span>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      signal === "매수"
                        ? "#059669"
                        : (signal as string) === "매도"
                          ? "#dc2626"
                          : "#737373",
                  }}
                >
                  {signal}
                </span>
              </div>
            )
          )}
        </div>
        <RiskGauge value={RISK_LEVEL_DUMMY} />

        <ReturnChartCard />

        <TechnicalScoreCard />

        <BacktestChartCard />

        <SupplyDemandCard />

        <RippleEffectCard />

        <div
          style={{
            marginTop: "1.5rem",
            padding: "1.25rem",
            backgroundColor: "#fff",
            borderRadius: "8px",
            border: "1px solid #e5e5e5",
          }}
        >
          <h3
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              marginBottom: "1rem",
              color: "#1a1a1a",
            }}
          >
            연관 종목 순위
          </h3>
          <div style={{ fontSize: "0.8125rem", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.25rem", color: "#737373", fontWeight: 500 }}>
                    종목
                  </th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.25rem", color: "#737373", fontWeight: 500 }}>
                    최종가
                  </th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.25rem", color: "#737373", fontWeight: 500 }}>
                    등락률
                  </th>
                </tr>
              </thead>
              <tbody>
                {RELATED_STOCKS_DUMMY.map((stock, i) => (
                  <tr key={stock.symbol} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "0.5rem 0.25rem" }}>
                      <div style={{ fontWeight: 600, color: "#1a1a1a" }}>{stock.symbol}</div>
                      <div style={{ fontSize: "0.75rem", color: "#737373" }}>{stock.name}</div>
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem 0.25rem", color: "#404040" }}>
                      {stock.price.toLocaleString()}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "0.5rem 0.25rem",
                        fontWeight: 600,
                        color: stock.change >= 0 ? "#059669" : "#dc2626",
                      }}
                    >
                      {stock.change >= 0 ? "+" : ""}
                      {stock.change}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
    </main>
  );
}
