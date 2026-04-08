/**
 * 브라우저 localStorage 기반 관심 기사 목록
 * (클라이언트에서만 호출)
 */

const STORAGE_KEY = "fam_article_watchlist_v1";

export interface WatchlistArticle {
  articleId: string;
  title: string;
  tickers: string[];
  addedAt: number;
}

function parse(): WatchlistArticle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { articles?: WatchlistArticle[] };
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

function persist(articles: WatchlistArticle[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ articles }));
}

export function getWatchlistArticles(): WatchlistArticle[] {
  return parse();
}

export function isArticleInWatchlist(articleId: string): boolean {
  return parse().some((a) => a.articleId === articleId);
}

export function addArticleToWatchlist(entry: Omit<WatchlistArticle, "addedAt">): void {
  const cur = parse().filter((a) => a.articleId !== entry.articleId);
  cur.unshift({
    ...entry,
    addedAt: Date.now(),
  });
  persist(cur);
}

export function removeArticleFromWatchlist(articleId: string): void {
  persist(parse().filter((a) => a.articleId !== articleId));
}

export function toggleArticleWatchlist(entry: Omit<WatchlistArticle, "addedAt">): boolean {
  if (isArticleInWatchlist(entry.articleId)) {
    removeArticleFromWatchlist(entry.articleId);
    return false;
  }
  addArticleToWatchlist(entry);
  return true;
}
