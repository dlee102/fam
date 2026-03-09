"use client";

import { useState, useEffect } from "react";
import { CandlestickChart } from "./CandlestickChart";

interface StockChartToggleProps {
  newsId: string;
  tickers: string[];
  publishedDate: string;
  tickerNames?: Record<string, string>;
  /** 차트를 처음부터 펼쳐서 표시 (기본: true) */
  defaultOpen?: boolean;
}

interface DailyOhlc {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function StockChartToggle({ newsId, tickers, publishedDate, tickerNames, defaultOpen = true }: StockChartToggleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<Record<string, DailyOhlc[]> | null>(null);
  const [returns, setReturns] = useState<Record<string, { "1d": number | null; "2d": number | null; "3d": number | null; "10d": number | null }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateStr = publishedDate.replace(/-/g, "");
  const validTickers = tickers.filter((t) => /^\d{6}$/.test(t));
  const displayName = (t: string) => tickerNames?.[t] ?? t;

  useEffect(() => {
    if (!open || validTickers.length === 0) return;
    setLoading(true);
    setError(null);
    fetch(
      `/api/stock-chart?date=${dateStr}&tickers=${validTickers.join(",")}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setChartData(null);
          setReturns(null);
          setSelectedTicker(null);
        } else {
          setChartData(d.data);
          setReturns(d.returns ?? null);
          const firstWithData = validTickers.find((t) => d.data?.[t]?.length);
          setSelectedTicker(firstWithData ?? validTickers[0] ?? null);
        }
      })
      .catch(() => {
        setError("데이터를 불러올 수 없습니다.");
        setChartData(null);
        setReturns(null);
        setSelectedTicker(null);
      })
      .finally(() => setLoading(false));
  }, [open, dateStr, validTickers.join(",")]);

  if (validTickers.length === 0) return null;

  const tickersWithData = chartData
    ? validTickers.filter((t) => chartData[t]?.length)
    : [];

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1.25rem",
        backgroundColor: "#fafafa",
        borderRadius: "8px",
        border: "1px solid #e5e5e5",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          padding: 0,
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "#1a1a1a",
          textAlign: "left",
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          ▶
        </span>
        발행일 {publishedDate} 전후 ±10일 주가 ({validTickers.map(displayName).join(", ")})
      </button>

      {open && (
        <div style={{ marginTop: "1rem" }}>
          {!loading && !error && returns && Object.keys(returns).length > 0 && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor: "#fff",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
                overflowX: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", color: "#6b7280", fontWeight: 500 }}>
                      종목
                    </th>
                    <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#6b7280", fontWeight: 500 }}>
                      1일
                    </th>
                    <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#6b7280", fontWeight: 500 }}>
                      2일
                    </th>
                    <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#6b7280", fontWeight: 500 }}>
                      3일
                    </th>
                    <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#6b7280", fontWeight: 500 }}>
                      10일
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(returns).map(([ticker, r]) => (
                    <tr key={ticker} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600, color: "#1a1a1a" }}>
                        {displayName(ticker)}
                      </td>
                      {(["1d", "2d", "3d", "10d"] as const).map((key) => {
                        const v = r[key];
                        return (
                          <td
                            key={key}
                            style={{
                              textAlign: "right",
                              padding: "0.4rem 0.5rem",
                              fontWeight: 600,
                              color: v != null ? (v >= 0 ? "#059669" : "#dc2626") : "#9ca3af",
                            }}
                          >
                            {v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {loading && (
            <p style={{ fontSize: "0.875rem", color: "#737373" }}>로딩 중...</p>
          )}
          {error && (
            <p style={{ fontSize: "0.875rem", color: "#dc2626" }}>{error}</p>
          )}
          {!loading && !error && tickersWithData.length > 0 && selectedTicker && chartData?.[selectedTicker] && (
            <div>
              {tickersWithData.length > 1 && (
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                  {tickersWithData.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTicker(t)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.8125rem",
                        fontWeight: selectedTicker === t ? 600 : 500,
                        color: selectedTicker === t ? "#059669" : "#6b7280",
                        backgroundColor: selectedTicker === t ? "#ecfdf5" : "#f9fafb",
                        border: `1px solid ${selectedTicker === t ? "#059669" : "#e5e7eb"}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      {displayName(t)}
                    </button>
                  ))}
                </div>
              )}
              <CandlestickChart
                data={chartData[selectedTicker]}
                refDate={dateStr}
                height={280}
              />
            </div>
          )}
          {!loading && !error && tickersWithData.length === 0 && chartData && (
            <p style={{ fontSize: "0.875rem", color: "#737373" }}>
              해당 기간 주가 데이터가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
