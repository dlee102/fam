import Link from "next/link";
import {
  getSomedayNewsFeedDebugSnapshot,
  getSomedayNewsList,
  type SomedayNewsFeedDebugSnapshot,
} from "@/lib/somedaynews-articles";

const LIST_LIMIT = 150;

/** 목록이 0일 때: SomedayNews는 RTDB만 사용 → 서비스 계정·노드 데이터·매니페스트 교집합 순으로 안내 */
function homeFeedEmptyExplanation(d: SomedayNewsFeedDebugSnapshot): string {
  if (d.somedaySource === "unconfigured") {
    return "서버(Admin)가 RTDB를 읽지 못했습니다. .env.local에 FIREBASE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS(서비스 계정 JSON 경로)를 설정하고 dev 서버를 재시작하세요. NEXT_PUBLIC_* 만으로는 서버에서 DB를 읽을 수 없습니다.";
  }
  if (d.rawRecordCount === 0) {
    return "Firebase RTDB의 SomedayNews 배열이 비어 있거나 없습니다. 노드 somedaynews/somedaynews_article_tickers 를 확인하거나, 로컬 JSON이 있다면 npm run sync-somedaynews-firebase 로 올리세요.";
  }
  if (d.dedupedArticleCount > 0 && d.afterFilterTotal === 0) {
    return "RTDB에는 기사가 있으나, EODHD 5분봉·일봉 매니페스트에 연결된 article_id와 겹치지 않습니다.";
  }
  return "조건에 맞는 뉴스가 없습니다.";
}

const homeListOptions = {
  limit: LIST_LIMIT,
  requireIntradayOk: true as const,
};

export default async function Home() {
  const showFeedDebug =
    process.env.NODE_ENV === "development" || process.env.DEBUG_HOME_FEED === "1";

  const [{ items: articles, total }, feedDebug] = await Promise.all([
    getSomedayNewsList(homeListOptions),
    getSomedayNewsFeedDebugSnapshot(homeListOptions),
  ]);

  if (showFeedDebug) {
    console.log("[home feed debug]", JSON.stringify(feedDebug, null, 2));
  }

  return (
    <main className="news-container">
      <header className="page-heading">
        <h1 className="page-heading__title">FAM 뉴스</h1>
      </header>

      <section className="feed" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="feed__label">
          API 수집 뉴스 목록
        </h2>
        <p className="feed__meta muted-text" style={{ margin: "0 0 1rem", fontSize: "0.875rem" }}>
          {total === 0
            ? homeFeedEmptyExplanation(feedDebug)
            : `5분봉 연동(EODHD) 기사 ${total.toLocaleString()}건 중 최신 ${articles.length.toLocaleString()}건`}
        </p>
        <ul className="feed__list">
          {articles.length === 0 ? (
            <li className="feed__empty">표시할 뉴스가 없습니다.</li>
          ) : (
            articles.map((article, i) => (
              <li
                key={article.article_id}
                className={`feed__item${i < articles.length - 1 ? " feed__item--rule" : ""}`}
              >
                <Link href={`/article/${encodeURIComponent(article.article_id)}`} className="feed__link article-link">
                  <time
                    dateTime={article.published_at}
                    className="feed__time"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {article.published_at}
                  </time>
                  <span className="feed__title">{article.title}</span>
                  {article.stock_codes.length > 0 ? (
                    <span
                      className="feed__tickers"
                      style={{
                        display: "block",
                        marginTop: "0.5rem",
                        fontSize: "0.6875rem",
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {article.stock_codes.join(", ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      {showFeedDebug ? (
        <section
          className="feed-debug"
          aria-label="홈 피드 디버그"
          style={{
            marginTop: "2rem",
            padding: "0.75rem 1rem",
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
            background: "var(--quant-canvas, rgba(0,0,0,0.04))",
            borderRadius: "var(--radius-sm, 6px)",
            border: "1px dashed var(--color-border, #ccc)",
          }}
        >
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              홈 피드 디버그 (dev / DEBUG_HOME_FEED)
            </summary>
            <pre
              style={{
                margin: "0.75rem 0 0",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(feedDebug, null, 2)}
            </pre>
            <p style={{ margin: "0.5rem 0 0", opacity: 0.85 }}>
              터미널에도 <code>[home feed debug]</code> 로그가 출력됩니다. somedaySource가
              unconfigured면 Admin RTDB 미설정, rawRecordCount=0이면 RTDB 노드가 비었거나 없음.
              dedupedArticleCount는 있는데 afterFilterTotal=0이면 매니페스트와 article_id가 안 맞는 경우입니다.
            </p>
          </details>
        </section>
      ) : null}
    </main>
  );
}
