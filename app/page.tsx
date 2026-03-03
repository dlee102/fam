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
    <main className="news-container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <header style={{ marginBottom: "2.5rem", borderBottom: "1px solid #e5e5e5", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          FAM 뉴스
        </h1>
      </header>

      <section>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem", color: "#404040" }}>
          팜이데일리 최신 기사
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {articles.length === 0 ? (
            <li style={{ padding: "1rem 0", color: "#737373" }}>
              기사를 불러오는 중입니다...
            </li>
          ) : (
            articles.map((article, i) => (
              <li
                key={article.newsId}
                style={{
                  padding: "0.75rem 0",
                  borderBottom: i < articles.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <Link
                  href={`/article/${article.newsId}`}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    alignItems: "flex-start",
                    textDecoration: "none",
                    color: "#1a1a1a",
                  }}
                >
                  {article.thumbnail && (
                    <img
                      src={article.thumbnail}
                      alt=""
                      style={{
                        width: "80px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontSize: "1rem", lineHeight: 1.4, flex: 1 }}>
                    {article.title}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
