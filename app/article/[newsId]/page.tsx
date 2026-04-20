import Link from "next/link";
import { fetchArticleContent } from "@/lib/crawl-article";
import { buildArticleExcerptForQuant } from "@/lib/article-excerpt-for-quant";
import { getArticleByNewsId } from "@/lib/news-tickers";
import { getSomedayNewsByArticleId } from "@/lib/somedaynews-articles";
import { getTickerName, replaceTickerCodesWithNames } from "@/lib/ticker-names";
import { pickPrimaryQuantTicker } from "@/lib/pick-primary-quant-ticker";
import { getTickersForArticle } from "@/lib/quant-engine";
import { buildArticleBioPeerMapModel } from "@/lib/bio-business-peer-data";
import { getQuantV2ScoreForArticle } from "@/lib/quant-v2-prediction";
import { QuantSidebar } from "./QuantSidebar";
import { ArticleBioPeerMap } from "./ArticleBioPeerMap";
import { ArticleRiskWatchPanel } from "./ArticleRiskWatchPanel";

function tickerNameMap(codes: string[]): Record<string, string> {
  return Object.fromEntries(
    codes.filter((t) => /^\d{6}$/.test(t)).map((t) => [t, getTickerName(t)])
  );
}

function mergeArticleTickerList(
  entryTickers: string[] | undefined,
  apiStockCodes: string[] | undefined,
  quantTickers: string[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: unknown) => {
    const s = String(t ?? "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  for (const t of entryTickers ?? []) push(t);
  for (const t of apiStockCodes ?? []) push(t);
  for (const t of quantTickers) push(t);
  return out;
}


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
  const apiNews = await getSomedayNewsByArticleId(newsId);
  const quantTickers = await getTickersForArticle(newsId);

  if (!article && apiNews) {
    const railTickers = mergeArticleTickerList(undefined, apiNews.stock_codes, quantTickers);
    const nameMap = tickerNameMap(railTickers);
    const bioPeerModel = buildArticleBioPeerMapModel(railTickers, nameMap);
    const primaryQuantTicker =
      pickPrimaryQuantTicker(railTickers, quantTickers) ??
      quantTickers[0] ??
      railTickers.find((t) => /^\d{6}$/.test(String(t).trim()));
    const primaryTickerForScore = primaryQuantTicker ?? quantTickers[0] ?? undefined;
    const predictionScore = await getQuantV2ScoreForArticle(newsId, primaryTickerForScore);
    return (
      <main className="article-page-layout">
        <Link href="/" className="back-link back-link--article">
          ← 목록으로
        </Link>
        <div className="article-page-body">
          <article className="article-page-article article-page-body__main">
            <h1 className="article-page-article__title">
              {replaceTickerCodesWithNames(apiNews.title, railTickers)}
            </h1>
            <time
              dateTime={apiNews.published_at}
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", display: "block", marginBottom: "0.75rem" }}
            >
              {apiNews.published_at}
            </time>
            <p className="muted-text" style={{ fontSize: "0.875rem", marginBottom: "1.25rem", lineHeight: 1.55 }}>
              SomedayNews API로 수집한 메타데이터입니다. 원문 본문은 이 화면에 포함되지 않습니다.
            </p>
          </article>
          <div className="article-page-body__right-col">
            <QuantSidebar
              articleId={newsId}
              ticker={primaryQuantTicker}
              chartTickers={railTickers}
              chartTickerNames={nameMap}
              articleTitle={replaceTickerCodesWithNames(apiNews.title, railTickers)}
              articleExcerpt=""
              predictionScore={predictionScore}
            />
            {bioPeerModel ? <ArticleBioPeerMap model={bioPeerModel} /> : null}
            <ArticleRiskWatchPanel
              articleId={newsId}
              title={replaceTickerCodesWithNames(apiNews.title, railTickers)}
              tickers={railTickers}
              tickerNames={nameMap}
            />
          </div>
        </div>
      </main>
    );
  }

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

  const railTickers = mergeArticleTickerList(tickerEntry?.tickers, apiNews?.stock_codes, quantTickers);
  const nameMap = tickerNameMap(railTickers);
  const bioPeerModel = buildArticleBioPeerMapModel(railTickers, nameMap);
  const primaryQuantTicker =
    pickPrimaryQuantTicker(railTickers, quantTickers) ??
    quantTickers[0] ??
    railTickers.find((t) => /^\d{6}$/.test(String(t).trim()));
  const primaryTickerForScore2 = primaryQuantTicker ?? quantTickers[0] ?? undefined;
  const predictionScore = await getQuantV2ScoreForArticle(newsId, primaryTickerForScore2);

  const quantArticleExcerpt = replaceTickerCodesWithNames(
    buildArticleExcerptForQuant(article),
    railTickers
  );

  return (
    <main className="article-page-layout">
      <Link href="/" className="back-link back-link--article">
        ← 목록으로
      </Link>
      <div className="article-page-body">
        <article className="article-page-article article-page-body__main">
          <h1 className="article-page-article__title">
            {replaceTickerCodesWithNames(article.title, railTickers)}
          </h1>
          {article.subtitle && (
            <p style={{ fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", lineHeight: 1.55 }}>
              {replaceTickerCodesWithNames(article.subtitle, railTickers)}
            </p>
          )}
          {article.date && (
            <time style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", display: "block", marginBottom: "1.5rem" }}>
              {article.date}
            </time>
          )}
          <div
            className="article-body"
            style={{ fontSize: "1.125rem", lineHeight: 1.85, color: "var(--color-text)" }}
          >
            {(article.bodyBlocks?.length
              ? article.bodyBlocks
              : article.body.split(/\n\n+/).filter((p) => p.trim()).map((c) => ({ type: "text" as const, content: c }))
            ).flatMap((block, i) =>
              block.type === "text"
                ? block.content.split(/\n\n+/).filter((p) => p.trim()).map((para, j) => (
                    <p key={`${i}-${j}`} style={{ marginBottom: "1.5rem", marginTop: 0 }}>
                      {replaceTickerCodesWithNames(para.trim(), railTickers)}
                    </p>
                  ))
                : [
                    <figure key={i} style={{ margin: "2rem 0", textAlign: "center" }}>
                      <img
                        src={block.image.src}
                        alt={replaceTickerCodesWithNames(block.image.caption || "", railTickers)}
                        style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
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
                          {replaceTickerCodesWithNames(block.image.caption, railTickers)}
                        </figcaption>
                      )}
                    </figure>,
                  ]
            )}
          </div>
        </article>
        <div className="article-page-body__right-col">
          <QuantSidebar
            articleId={newsId}
            ticker={primaryQuantTicker}
            chartTickers={railTickers}
            chartTickerNames={nameMap}
            articleTitle={replaceTickerCodesWithNames(article.title, railTickers)}
            articleExcerpt={quantArticleExcerpt}
            predictionScore={predictionScore}
          />
          {bioPeerModel ? <ArticleBioPeerMap model={bioPeerModel} /> : null}
          <ArticleRiskWatchPanel
            articleId={newsId}
            title={replaceTickerCodesWithNames(article.title, railTickers)}
            tickers={railTickers}
            tickerNames={nameMap}
          />
        </div>
      </div>
    </main>
  );
}
