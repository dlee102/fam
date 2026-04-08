"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuantInsight } from "@/lib/quant-engine";
import {
  getWatchlistArticles,
  isArticleInWatchlist,
  toggleArticleWatchlist,
} from "@/lib/article-watchlist";

type RiskTone = "loading" | "neutral" | "ok" | "caution" | "danger";

function riskToneFromInsight(d: QuantInsight | null): RiskTone {
  if (!d) return "neutral";
  const { grade, primary_signal, all_signals } = d;
  const warn = all_signals.some(
    (s) => s.type === "MOMENTUM_WARNING" && (s.confidence === "HIGH" || s.strength >= 60)
  );
  if (grade === "D" || warn) return "danger";
  if (grade === "C" || primary_signal.type === "MOMENTUM_WARNING") return "caution";
  if (grade === "A" || grade === "B") return "ok";
  return "neutral";
}

function RiskCard({ tone, summary }: { tone: RiskTone; summary?: string }) {
  const styles: Record<RiskTone, { border: string; bg: string; icon: string; title: string; text: string }> = {
    loading: {
      border: "var(--color-border-subtle)",
      bg: "var(--color-surface)",
      icon: "◌",
      title: "리스크 평가",
      text: "지표를 불러오는 중입니다…",
    },
    neutral: {
      border: "var(--color-border-subtle)",
      bg: "var(--color-surface)",
      icon: "○",
      title: "리스크 정보 없음",
      text: "EOD 데이터가 없어 사전 리스크를 표시할 수 없습니다. 참고용으로만 보세요.",
    },
    ok: {
      border: "color-mix(in srgb, var(--quant-up) 35%, var(--color-border-subtle))",
      bg: "color-mix(in srgb, var(--quant-up) 6%, var(--color-surface))",
      icon: "●",
      title: "리스크 상대적으로 낮음",
      text:
        summary ??
        "퀀트 등급이 양호합니다. 다만 과거 통계 기반이며 실제 손익을 보장하지 않습니다.",
    },
    caution: {
      border: "color-mix(in srgb, #d97706 40%, var(--color-border-subtle))",
      bg: "color-mix(in srgb, #d97706 7%, var(--color-surface))",
      icon: "▲",
      title: "리스크 주의",
      text:
        summary ??
        "일부 지표에서 과열·조정 가능성이 보입니다. 포지션 크기와 손절을 점검하세요.",
    },
    danger: {
      border: "color-mix(in srgb, var(--quant-down) 45%, var(--color-border-subtle))",
      bg: "color-mix(in srgb, var(--quant-down) 8%, var(--color-surface))",
      icon: "⚠",
      title: "리스크 경고",
      text:
        summary ??
        "등급이 낮거나 모멘텀 과열 신호가 있습니다. 추격 매수·장기 보유에 유의하세요.",
    },
  };
  const s = styles[tone];
  return (
    <div
      className="article-risk-watch__risk"
      style={{
        border: `1px solid ${s.border}`,
        background: s.bg,
        borderRadius: "var(--radius-lg)",
        padding: "1rem 0.875rem",
        boxShadow: "var(--shadow-sm)",
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <span style={{ fontSize: "1rem", lineHeight: 1.2, opacity: 0.9 }} aria-hidden>
          {s.icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            {s.title}
          </p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", lineHeight: 1.55, color: "var(--color-text)" }}>
            {s.text}
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  articleId: string;
  title: string;
  tickers: string[];
  tickerNames?: Record<string, string>;
  primaryTicker?: string;
  className?: string;
}

/** 퀀트 사이드바 아래에 붙는 리스크 알림 + 관심종목 카드 */
export function ArticleRiskWatchPanel({
  articleId,
  title,
  tickers,
  tickerNames,
  primaryTicker,
  className,
}: Props) {
  const [insight, setInsight] = useState<QuantInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    setWatched(isArticleInWatchlist(articleId));
    setSavedCount(getWatchlistArticles().length);
  }, [articleId]);

  useEffect(() => {
    setInsightLoading(true);
    const params = new URLSearchParams({ article_id: articleId });
    if (primaryTicker) params.set("ticker", primaryTicker);
    fetch(`/api/quant/insight?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: QuantInsight | null) => {
        setInsight(d && d.indicators ? d : null);
      })
      .catch(() => setInsight(null))
      .finally(() => setInsightLoading(false));
  }, [articleId, primaryTicker]);

  const tone: RiskTone = insightLoading ? "loading" : insight ? riskToneFromInsight(insight) : "neutral";
  const riskSummary =
    insight && !insightLoading
      ? `${insight.summary} (참고용, 투자 권유 아님)`
      : undefined;

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
      aria-label="리스크 및 관심종목"
    >
      <RiskCard tone={tone} summary={riskSummary} />

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
