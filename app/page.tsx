import Link from "next/link";
import { fetchPharmArticles } from "@/lib/crawl-pharm";

export default async function Home() {
  let articles: Awaited<ReturnType<typeof fetchPharmArticles>> = [];
  try {
    articles = await fetchPharmArticles(5);
  } catch (e) {
    console.error("Failed to fetch articles:", e);
  }

  return (
    <main className="news-container">
      <header className="page-heading">
        <h1 className="page-heading__title">FAM 뉴스</h1>
      </header>

      <section className="feed" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="feed__label">
          팜이데일리 최신 기사
        </h2>
        <ul className="feed__list">
          {articles.length === 0 ? (
            <li className="feed__empty">기사를 불러오는 중입니다...</li>
          ) : (
            articles.map((article, i) => (
              <li
                key={article.newsId}
                className={`feed__item${i < articles.length - 1 ? " feed__item--rule" : ""}`}
              >
                <Link href={`/article/${article.newsId}`} className="feed__link article-link">
                  {article.thumbnail && (
                    <img
                      src={article.thumbnail}
                      alt=""
                      className="feed__thumb"
                      width={80}
                      height={60}
                    />
                  )}
                  <span className="feed__title">{article.title}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
