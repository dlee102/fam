"use client";

/**
 * 퀀트 기반 매수/매도/홀딩 가이드
 * - 통계 기반 일반 권장 (entry_hold_stats)
 * - 향후: 종목별 가격 반응 신호 (C/D=추가 매수, A/B=관망)
 */

interface QuantTradingGuideProps {
  /** entry_hold_stats.json summary (서버에서 전달) */
  entryHoldSummary?: {
    best_win_rate: { entry_label: string; hold_days: number; win_rate: number };
    best_avg_return: { entry_label: string; hold_days: number; avg_return: number };
  };
  /** 종목별 신호 (향후 확장) */
  tickerSignals?: Record<
    string,
    { signal: "추가 매수" | "관망" | "중립"; strategy?: string; reason?: string }
  >;
  tickerNames?: Record<string, string>;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function ret(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

export function QuantTradingGuide({
  entryHoldSummary,
  tickerSignals = {},
  tickerNames = {},
}: QuantTradingGuideProps) {
  const displayName = (t: string) => tickerNames[t] ?? t;

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1.25rem",
        backgroundColor: "#f0fdf4",
        borderRadius: "8px",
        border: "1px solid #bbf7d0",
      }}
    >
      <h3
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          marginBottom: "0.75rem",
          color: "#166534",
        }}
      >
        퀀트 매매 가이드
      </h3>

      {entryHoldSummary && (
        <div style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "#374151" }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong style={{ color: "#166534" }}>입장:</strong>{" "}
            {entryHoldSummary.best_win_rate.entry_label} 매수
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong style={{ color: "#166534" }}>보유:</strong>{" "}
            {entryHoldSummary.best_win_rate.hold_days} ~{" "}
            {entryHoldSummary.best_avg_return.hold_days} 거래일
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#6b7280", marginTop: "0.5rem" }}>
            {entryHoldSummary.best_win_rate.entry_label} 입장{" "}
            {entryHoldSummary.best_win_rate.hold_days}일 보유 시 승률{" "}
            {pct(entryHoldSummary.best_win_rate.win_rate)},{" "}
            {entryHoldSummary.best_avg_return.hold_days}일 보유 시 평균 수익{" "}
            {ret(entryHoldSummary.best_avg_return.avg_return)} (기사 유형 통계 기준)
          </div>
        </div>
      )}

      {Object.keys(tickerSignals).length > 0 && (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid #bbf7d0",
          }}
        >
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#166534",
              marginBottom: "0.5rem",
            }}
          >
            종목별 가격 반응
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {Object.entries(tickerSignals).map(([ticker, s]) => (
              <div
                key={ticker}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ fontWeight: 600, minWidth: "80px" }}>
                  {displayName(ticker)}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      s.signal === "추가 매수"
                        ? "#059669"
                        : s.signal === "관망"
                          ? "#dc2626"
                          : "#6b7280",
                  }}
                >
                  {s.signal}
                </span>
                {s.strategy?.trim() && (
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                    ({s.strategy})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!entryHoldSummary && Object.keys(tickerSignals).length === 0 && (
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          퀀트 데이터를 불러올 수 없습니다.
        </p>
      )}
    </div>
  );
}
