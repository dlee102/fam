import Link from "next/link";
import { getSomedayNewsList } from "@/lib/somedaynews-articles";

const LIST_LIMIT = 150;

export default function Home() {
  const { items: articles, total } = getSomedayNewsList({ limit: LIST_LIMIT });

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
            ? "EODHD 일봉 매니페스트에 연결된 기사가 없거나, SomedayNews JSON에 기록이 없습니다."
            : `EODHD 연결 기사 ${total.toLocaleString()}건 중 최신 ${articles.length.toLocaleString()}건`}
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
    </main>
  );
}
