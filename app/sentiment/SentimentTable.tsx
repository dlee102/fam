"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StockChartToggle } from "@/app/article/[newsId]/StockChartToggle";

function extractNewsId(url: string): string | null {
  const m = url?.match(/newsId=([^&]+)/);
  return m ? m[1] : null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 65) return "#22c55e";
  if (score <= 40) return "#ef4444";
  return "#71717a";
}

interface Article {
  url?: string;
  title?: string;
  tickers?: string[];
  published_date?: string;
  published_time?: string;
  sentiment_score?: number;
}

export function SentimentTable({
  articles,
  tickerNames,
}: {
  articles: Article[];
  tickerNames: Record<string, string>;
}) {
  const displayName = (t: string) => tickerNames[t] ?? t;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div style={{ overflowX: "auto", border: "1px solid #e5e5e5", borderRadius: "6px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ backgroundColor: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "500", color: "#666", width: "90px" }}>
              Date
            </th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "500", color: "#666" }}>Title</th>
            <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "500", color: "#666", width: "64px" }}>
              Score
            </th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "500", color: "#666", width: "120px" }}>
              Tickers
            </th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article: Article, index: number) => {
            const newsId = extractNewsId(article.url ?? "");
            const hasTickers = article.tickers?.length && article.published_date;
            const isExpanded = expandedIndex === index;

            return (
              <React.Fragment key={index}>
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "12px", color: "#888", whiteSpace: "nowrap" }}>
                    {article.published_date || "—"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {hasTickers ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedIndex(isExpanded ? null : index);
                        }}
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          color: "#111",
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                        }}
                      >
                        {article.title}
                      </button>
                    ) : newsId ? (
                      <Link href={`/article/${newsId}`} style={{ color: "#111", textDecoration: "none" }}>
                        {article.title}
                      </Link>
                    ) : (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#111", textDecoration: "none" }}
                      >
                        {article.title}
                      </a>
                    )}
                    {hasTickers && newsId && (
                      <Link
                        href={`/article/${newsId}`}
                        style={{
                          fontSize: "11px",
                          color: "#737373",
                          marginLeft: "8px",
                          textDecoration: "none",
                        }}
                      >
                        기사 보기 →
                      </Link>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: getScoreColor(article.sentiment_score ?? 0),
                    }}
                  >
                    {article.sentiment_score}
                  </td>
                  <td style={{ padding: "12px", color: "#666", fontSize: "12px" }}>
                    {article.tickers?.length
                      ? article.tickers
                          .map((t: string) => (/^\d{6}$/.test(t) ? displayName(t) : t))
                          .join(", ")
                      : "—"}
                  </td>
                </tr>
                {isExpanded && hasTickers && newsId && (
                  <tr key={`${index}-chart`}>
                    <td colSpan={4} style={{ padding: 0, borderBottom: "1px solid #e5e5e5", backgroundColor: "#fafafa" }}>
                      <div style={{ padding: "16px 24px" }}>
                        <StockChartToggle
                          newsId={newsId}
                          tickers={article.tickers!}
                          publishedDate={article.published_date!}
                          tickerNames={Object.fromEntries(
                            article.tickers!
                              .filter((t: string) => /^\d{6}$/.test(t))
                              .map((t: string) => [t, displayName(t)])
                          )}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
