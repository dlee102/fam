"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getWatchlistArticles,
  isArticleInWatchlist,
  toggleArticleWatchlist,
} from "@/lib/article-watchlist";

interface Props {
  articleId: string;
  title: string;
  tickers: string[];
  tickerNames?: Record<string, string>;
  className?: string;
}

/** 퀀트 사이드바 아래 — 관심종목 카드 */
export function ArticleRiskWatchPanel({
  articleId,
  title,
  tickers,
  tickerNames,
  className,
}: Props) {
  const [watched, setWatched] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    setWatched(isArticleInWatchlist(articleId));
    setSavedCount(getWatchlistArticles().length);
  }, [articleId]);

  const onToggleWatch = useCallback(() => {
    const next = toggleArticleWatchlist({
      articleId,
      title: title.slice(0, 200),
      tickers,
    });
    setWatched(next);
    setSavedCount(getWatchlistArticles().length);
    setToast(next ? "관심 목록에 추가했습니다." : "관심 목록에서 제거했습니다.");
    window.setTimeout(() => setToast(null), 2400);
  }, [articleId, title, tickers]);

  return (
    <aside
      className={["article-risk-watch", className].filter(Boolean).join(" ")}
      aria-label="관심종목"
    >
      <div className="article-risk-watch__panel">
        <p className="article-risk-watch__heading">관심종목</p>
        <button
          type="button"
          className={`article-risk-watch__btn-main${watched ? " article-risk-watch__btn-main--active" : ""}`}
          onClick={onToggleWatch}
        >
          <span className="article-risk-watch__btn-icon" aria-hidden>
            {watched ? "★" : "☆"}
          </span>
          {watched ? "관심에서 제거" : "이 기사 · 종목 관심 추가"}
        </button>
        {toast ? (
          <p className="article-risk-watch__toast" role="status">
            {toast}
          </p>
        ) : null}

        {tickers.length > 0 ? (
          <ul className="article-risk-watch__ticker-list" aria-label="연결된 종목 코드">
            {tickers.map((code) => {
              const name = tickerNames?.[code] ?? "";
              return (
                <li key={code} className="article-risk-watch__ticker-row">
                  <span className="article-risk-watch__ticker-code">{code}</span>
                  {name ? <span className="article-risk-watch__ticker-name">{name}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="article-risk-watch__hint">이 기사에 매핑된 종목 코드가 없습니다.</p>
        )}

        <p className="article-risk-watch__footer">
          저장된 관심 기사 <strong>{savedCount ?? "—"}</strong>건 · 이 브라우저에만 저장됩니다.
        </p>
      </div>
    </aside>
  );
}
