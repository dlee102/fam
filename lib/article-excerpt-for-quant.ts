import type { ArticleContent } from "@/lib/crawl-article";

const MAX = 3200;

/** AI 의견 API용: 부제·본문 텍스트만 이어붙여 길이 제한 */
export function buildArticleExcerptForQuant(article: ArticleContent): string {
  const chunks: string[] = [];
  if (article.subtitle?.trim()) chunks.push(article.subtitle.trim());
  const blocks =
    article.bodyBlocks?.length > 0
      ? article.bodyBlocks
      : article.body
          .split(/\n\n+/)
          .filter((p) => p.trim())
          .map((c) => ({ type: "text" as const, content: c }));
  for (const b of blocks) {
    if (b.type === "text" && b.content.trim()) chunks.push(b.content.trim());
  }
  const t = chunks.join("\n\n");
  if (t.length <= MAX) return t;
  return `${t.slice(0, MAX)}…`;
}
