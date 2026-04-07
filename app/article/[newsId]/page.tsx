import Link from "next/link";
import { fetchArticleContent } from "@/lib/crawl-article";
import { getArticleByNewsId } from "@/lib/news-tickers";
import { getTickerName } from "@/lib/ticker-names";
import { StockChartToggle } from "./StockChartToggle";
import { AIScoreGauge } from "./AIScoreGauge";
import { RiskGauge } from "./RiskGauge";
import { ReturnChartCard } from "./ReturnChartCard";
import { TechnicalScoreCard } from "./TechnicalScoreCard";
import { BacktestChartCard } from "./BacktestChartCard";
import { RippleEffectCard } from "./RippleEffectCard";
import { StatsArticleAiRankCard } from "@/app/stats/StatsArticleAiRankCard";
import { qLabel, sb } from "./sidebar-tokens";

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
  const [articleResult, tickerResult] = await Promise.allSettled([
    fetchArticleContent(newsId),
    Promise.resolve(getArticleByNewsId(newsId)),
  ]);
  const article = articleResult.status === "fulfilled" ? articleResult.value : null;
  const tickerEntry = tickerResult.status === "fulfilled" ? tickerResult.value : null;

  if (!article) {
    return (
      <main className="news-container">
        <p className="muted-text">기사를 불러올 수 없습니다.</p>
        <Link href="/" className="back-link">
          ← 목록으로
        </Link>
      </main>
    );
  }

  return (
    <main className="article-page-layout">
      <Link href="/" className="back-link back-link--article">
        ← 목록으로
      </Link>

      <article className="article-page-article">
        <h1
          style={{
            fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)",
            fontWeight: 700,
            lineHeight: 1.35,
            marginBottom: "1rem",
            color: "var(--color-text)",
          }}
        >
          {article.title}
        </h1>
        {article.subtitle && (
          <p style={{ fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", lineHeight: 1.55 }}>
            {article.subtitle}
          </p>
        )}
        {article.date && (
          <time style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", display: "block", marginBottom: "1.5rem" }}>
            {article.date}
          </time>
        )}
        {tickerEntry?.tickers?.length && tickerEntry?.published_date && (
          <StockChartToggle
            newsId={newsId}
            tickers={tickerEntry.tickers}
            publishedDate={tickerEntry.published_date}
            tickerNames={Object.fromEntries(
              tickerEntry.tickers
                .filter((t) => /^\d{6}$/.test(t))
                .map((t) => [t, getTickerName(t)])
            )}
          />
        )}
        <div
          className="article-body"
          style={{
            fontSize: "1.125rem",
            lineHeight: 1.85,
            color: "var(--color-text)",
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
                          color: "var(--color-text-muted)",
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

      <section className="article-quant-dashboard" aria-labelledby="article-quant-dashboard-title">
        <header className="article-quant-dashboard-header">
          <h2 id="article-quant-dashboard-title" className="article-quant-dashboard-title">
            퀀트 인사이트
          </h2>
          <p className="article-quant-dashboard-desc">
            기사 맥락을 숫자로 요약합니다. 모델·더미 구간이 포함될 수 있습니다.
          </p>
        </header>

        <div className="article-quant-dashboard-rows">
          <div className="article-quant-dashboard-grid article-quant-dashboard-grid--kpi">
            <div className="quant-dash-cell">
              <AIScoreGauge score={80} />
            </div>
            <div className="quant-dash-cell">
              <div>
                <div style={{ ...qLabel, marginBottom: "0.625rem" }}>시그널 · 더미</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {Object.entries(QUANT_INDICATOR_DUMMY).map(([term, signal]) => (
                    <div
                      key={term}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span style={{ color: sb.muted }}>{term}</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            signal === "매수"
                              ? sb.up
                              : (signal as string) === "매도"
                                ? sb.down
                                : sb.text,
                        }}
                      >
                        {signal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="quant-dash-cell">
              <RiskGauge value={RISK_LEVEL_DUMMY} />
            </div>
          </div>

          <div className="article-quant-dashboard-grid article-quant-dashboard-grid--charts">
            <div className="quant-dash-cell">
              <ReturnChartCard />
            </div>
            <div className="quant-dash-cell">
              <BacktestChartCard />
            </div>
          </div>

          <div className="article-quant-dashboard-grid">
            <div className="quant-dash-cell">
              <TechnicalScoreCard symbol="KR7000020008" date="20240102" />
            </div>
          </div>

          <div className="article-quant-dashboard-grid article-quant-dashboard-grid--split">
            <div className="quant-dash-cell">
              <RippleEffectCard />
            </div>
            <div className="quant-dash-cell">
              <section>
                <div style={{ ...qLabel, marginBottom: "0.625rem" }}>연관 종목</div>
                <div style={{ fontSize: "0.75rem", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${sb.border}` }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "0.35rem 0",
                            color: sb.faint,
                            fontWeight: 600,
                            fontSize: "0.5625rem",
                            letterSpacing: "0.06em",
                          }}
                        >
                          심볼
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "0.35rem 0",
                            color: sb.faint,
                            fontWeight: 600,
                            fontSize: "0.5625rem",
                            letterSpacing: "0.06em",
                          }}
                        >
                          가격
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "0.35rem 0",
                            color: sb.faint,
                            fontWeight: 600,
                            fontSize: "0.5625rem",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Δ%
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {RELATED_STOCKS_DUMMY.map((stock) => (
                        <tr key={stock.symbol} style={{ borderTop: `1px solid ${sb.rule}` }}>
                          <td style={{ padding: "0.4rem 0" }}>
                            <div style={{ fontWeight: 600, color: sb.text, fontSize: "0.75rem" }}>{stock.symbol}</div>
                            <div style={{ fontSize: "0.625rem", color: sb.muted }}>{stock.name}</div>
                          </td>
                          <td style={{ textAlign: "right", padding: "0.4rem 0", color: sb.text }}>
                            {stock.price.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              padding: "0.4rem 0",
                              fontWeight: 600,
                              color: stock.change >= 0 ? sb.up : sb.down,
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
              </section>
            </div>
          </div>

          <div className="article-quant-dashboard-grid">
            <div className="quant-dash-cell">
              <StatsArticleAiRankCard embedded />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
