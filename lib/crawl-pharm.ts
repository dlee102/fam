import * as cheerio from "cheerio";

export interface PharmArticle {
  title: string;
  url: string;
  newsId: string;
  thumbnail?: string;
}

const EXCLUDE_MARKERS = [
  "프리미엄",
  "[only 이데일리]",
  "[only이데일리]",
  "유료",
  "유료기사",
];

function shouldExclude(title: string): boolean {
  return EXCLUDE_MARKERS.some((m) => title.includes(m));
}

function extractTitle(fullText: string): string {
  let text = fullText.replace(/\s+/g, " ").trim();
  // Remove author/date pattern: NameIYYYY.MM.DDITime
  text = text.replace(/\s+[가-힣A-Za-z·]+\s*I\d{4}\.\d{2}\.\d{2}I[^\s]+$/, "");
  // Take first part before summary (often starts with common words)
  const summaryStart = text.search(
    /\s(전\s세계|그\s|이\s|이번\s|올해\s|지난\s|한국\s|국내\s|해당\s|관련\s|특히\s|한\s주\()/
  );
  if (summaryStart > 15) {
    return text.slice(0, summaryStart).trim();
  }
  // Fallback: truncate to reasonable length
  return text.length > 80 ? text.slice(0, 77).trim() + "..." : text.trim();
}

export async function fetchPharmArticles(
  limit = 5
): Promise<PharmArticle[]> {
  const url = "https://pharm.edaily.co.kr/News/List_All?cd=PE";
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const articles: PharmArticle[] = [];

  $(".list_main").each((_, el) => {
    if (articles.length >= limit) return false;

    const $el = $(el);
    const $dt = $el.find("dt");
    const $link = $el.find('a[href*="News/Read"]').first();
    const $img = $el.find(".mainvisual img").first();

    if (!$link.length || !$dt.length) return;

    // 유료/프리미엄 기사 제외 (dt.icon_premium_b 클래스)
    const dtClass = $dt.attr("class") || "";
    if (dtClass.includes("premium") || dtClass.includes("pay")) return;

    const href = $link.attr("href");
    const text = ($dt.text() || $link.text()).trim();
    if (!href || !text || text.length < 5) return;

    const fullUrl = href.startsWith("http")
      ? href
      : `https://pharm.edaily.co.kr${href.startsWith("/") ? "" : "/"}${href}`;

    const newsId = fullUrl.match(/newsId=([^&]+)/)?.[1];
    if (!newsId) return;

    const title = extractTitle(text);
    if (!title || shouldExclude(title)) return;

    let thumbnail: string | undefined;
    const imgSrc = $img.attr("src");
    if (imgSrc && !imgSrc.includes("mosaic")) {
      thumbnail = imgSrc.startsWith("http") ? imgSrc : `https://image.edaily.co.kr${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`;
    }

    articles.push({ title, url: fullUrl, newsId, thumbnail });
  });

  return articles.slice(0, limit);
}
