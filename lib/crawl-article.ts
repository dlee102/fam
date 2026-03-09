import * as cheerio from "cheerio";

export interface ArticleImage {
  src: string;
  caption?: string;
}

export interface ArticleContent {
  title: string;
  subtitle?: string;
  date?: string;
  body: string;
  bodyHtml?: string;
  images: ArticleImage[];
  bodyBlocks: Array<{ type: "text"; content: string } | { type: "image"; image: ArticleImage }>;
}

export async function fetchArticleContent(
  newsId: string
): Promise<ArticleContent | null> {
  try {
    const url = `https://pharm.edaily.co.kr/News/Read?newsId=${newsId}&mediaCodeNo=257`;

    const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const title =
    $(".newsnewtitle").text().trim() ||
    $(".newsmaintitle h1").text().trim() ||
    "";
  const subtitle = $(".newssub li").first().text().trim() || undefined;
  const date = $(".newsdate li").first().text().replace("등록 ", "").trim() || undefined;

  const $body = $(".newsbody");
  const bodyHtml = $body.html() || "";

  const images: ArticleImage[] = [];
  const imagePlaceholder = "||IMG_PLACEHOLDER_";
  let processedHtml = bodyHtml;

  $body.find("img").each((_, el) => {
    const $img = $(el);
    const src = $img.attr("src");
    if (!src) return;
    const fullSrc = src.startsWith("http") ? src : `https://image.edaily.co.kr${src.startsWith("/") ? "" : "/"}${src}`;
    const $table = $img.closest("table");
    const caption = $table.find(".caption").text().trim() || undefined;
    const idx = images.length;
    images.push({ src: fullSrc, caption });
    const toReplace = $table.length ? $.html($table[0]) : $.html($img[0]);
    if (toReplace) {
      processedHtml = processedHtml.replace(toReplace, `${imagePlaceholder}${idx}||`);
    }
  });

  processedHtml = processedHtml
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/div>\s*<div/gi, "\n\n</div><div")
    .replace(/<\/td>\s*<\/tr>\s*<tr>/gi, "\n\n");
  const $temp = cheerio.load("<div>" + processedHtml + "</div>");
  const body = $temp("div").text().trim();

  const bodyBlocks: ArticleContent["bodyBlocks"] = [];
  const parts = body.split(new RegExp(`${imagePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)\\|\\|`, "g"));
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    if (i % 2 === 1 && /^\d+$/.test(part)) {
      const idx = parseInt(part, 10);
      if (images[idx]) bodyBlocks.push({ type: "image", image: images[idx] });
    } else {
      bodyBlocks.push({ type: "text", content: part });
    }
  }
  if (bodyBlocks.length === 0 && body) {
    bodyBlocks.push({ type: "text", content: body });
  }

  if (!title || !body) return null;

  const resultBlocks =
    bodyBlocks.length > 0
      ? bodyBlocks
      : body.split(/\n\n+/).filter((p) => p.trim()).map((c) => ({ type: "text" as const, content: c }));

  return { title, subtitle, date, body, bodyHtml, images, bodyBlocks: resultBlocks };
  } catch {
    return null;
  }
}
