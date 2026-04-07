"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { backtestingPanelCard } from "../lib/ui-styles";
import type { HorizonEntrySeries, TickerAttrRow } from "../lib/publish-horizon.types";
import { HORIZON_ENTRY_COLORS } from "./horizon-chart-data";

type Props = {
  tickerAttribution: Record<string, Record<string, TickerAttrRow[]>> | undefined;
  entries: Record<string, HorizonEntrySeries>;
  available: string[];
};

const HOLD_OPTIONS = [
  { label: "1일", value: "1" },
  { label: "5일", value: "5" },
  { label: "10일", value: "10" },
  { label: "22일", value: "22" },
] as const;

const TOP_N = 20;

export function TickerAttributionPanel({ tickerAttribution, entries, available }: Props) {
  const [selectedEntry, setSelectedEntry] = useState<string>(
    available[0] ?? "A"
  );
  const [selectedHold, setSelectedHold] = useState<string>("1");

  const rows = tickerAttribution?.[selectedEntry]?.[selectedHold] ?? null;

  const { positives, negatives, zeroCount } = useMemo(() => {
    if (!rows) return { positives: [], negatives: [], zeroCount: 0 };
    const desc = [...rows].sort((a, b) => b.avg_return_pct - a.avg_return_pct);
    const positives = desc.filter((r) => r.avg_return_pct > 0).slice(0, TOP_N);
    const negatives = desc
      .filter((r) => r.avg_return_pct < 0)
      .reverse()
      .slice(0, TOP_N);
    const zeroCount = rows.filter((r) => r.avg_return_pct === 0).length;
    return { positives, negatives, zeroCount };
  }, [rows]);

  const hasData = rows != null;
  const totalTickers = rows?.length ?? 0;
  const posCount = rows?.filter((r) => r.avg_return_pct > 0).length ?? 0;
  const negCount = rows?.filter((r) => r.avg_return_pct < 0).length ?? 0;

  return (
    <section style={backtestingPanelCard}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "0.6rem 1.25rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            종목별 귀속 분석
          </div>
          <div
            style={{ fontSize: "0.72rem", color: "var(--color-text-faint)" }}
          >
            동일 종목이 여러 기사에 등장하면 관측 수(n)가 늘어납니다.
          </div>
        </div>

        {/* Entry selector */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {available.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedEntry(k)}
              style={{
                padding: "0.32rem 0.5rem",
                borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${HORIZON_ENTRY_COLORS[k] ?? "#888"}`,
                background:
                  selectedEntry === k
                    ? `${HORIZON_ENTRY_COLORS[k] ?? "#888"}20`
                    : "transparent",
                color:
                  selectedEntry === k
                    ? (HORIZON_ENTRY_COLORS[k] ?? "#888")
                    : "var(--color-text-faint)",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.1s",
                textAlign: "left",
                maxWidth: "min(100%, 200px)",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: selectedEntry === k ? "var(--color-text)" : "var(--color-text-muted)",
                  fontWeight: 600,
                  lineHeight: 1.3,
                  fontSize: "0.7rem",
                }}
              >
                {entries[k]?.label ?? k}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "0.1rem",
                  fontSize: "0.62rem",
                  opacity: 0.85,
                }}
              >
                시나리오 {k}
              </span>
            </button>
          ))}
        </div>

        {/* Hold selector */}
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {HOLD_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setSelectedHold(o.value)}
              style={{
                padding: "0.22rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                border: "1.5px solid var(--color-border-subtle)",
                background:
                  selectedHold === o.value
                    ? "var(--color-surface-elevated, var(--color-surface))"
                    : "transparent",
                color:
                  selectedHold === o.value
                    ? "var(--color-text)"
                    : "var(--color-text-faint)",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p style={{ fontSize: "0.78rem", color: "var(--color-text-faint)" }}>
          종목별 귀속 데이터가 없습니다. 아래 명령어로 JSON을 재생성하세요.
          <br />
          <code style={{ fontSize: "0.72rem" }}>
            python3 scripts/entry_hold_analysis.py
          </code>
        </p>
      ) : (
        <>
          {/* Summary bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem 1.5rem",
              marginBottom: "1rem",
              fontSize: "0.8rem",
              color: "var(--color-text-muted)",
            }}
          >
            <span>
              전체{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {totalTickers}
              </strong>
              종목
            </span>
            <span>
              <span style={{ color: "var(--quant-up)", fontWeight: 600 }}>
                ▲ {posCount}
              </span>{" "}
              플러스
            </span>
            <span>
              <span style={{ color: "var(--quant-down)", fontWeight: 600 }}>
                ▼ {negCount}
              </span>{" "}
              마이너스
            </span>
            {zeroCount > 0 && <span>0% {zeroCount}종목</span>}
          </div>

          {/* Two-column table */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            {/* Positives */}
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--quant-up)",
                  marginBottom: "0.5rem",
                }}
              >
                수익 상위 {positives.length}종목
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>종목</th>
                    <th style={{ ...th, textAlign: "right" }}>n</th>
                    <th style={{ ...th, textAlign: "right" }}>평균 수익</th>
                    <th style={{ ...th, textAlign: "right" }}>승률</th>
                    <th style={{ ...th, textAlign: "right" }}>이익 평균</th>
                    <th style={{ ...th, textAlign: "right" }}>손실 평균</th>
                  </tr>
                </thead>
                <tbody>
                  {positives.map((r) => (
                    <tr
                      key={r.ticker}
                      style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                    >
                      <td style={td}>
                        <code style={{ fontSize: "0.72rem" }}>{r.ticker}</code>
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--color-text-muted)" }}>
                        {r.count}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          color: "var(--quant-up)",
                          fontWeight: 600,
                        }}
                      >
                        +{r.avg_return_pct.toFixed(2)}%
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {(r.win_rate * 100).toFixed(0)}%
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--quant-up)" }}>
                        {r.n_pos > 0 ? `+${r.avg_pos_return_pct.toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--quant-down)" }}>
                        {r.n_neg > 0 ? `${r.avg_neg_return_pct.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Negatives */}
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--quant-down)",
                  marginBottom: "0.5rem",
                }}
              >
                손실 상위 {negatives.length}종목
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>종목</th>
                    <th style={{ ...th, textAlign: "right" }}>n</th>
                    <th style={{ ...th, textAlign: "right" }}>평균 수익</th>
                    <th style={{ ...th, textAlign: "right" }}>승률</th>
                    <th style={{ ...th, textAlign: "right" }}>이익 평균</th>
                    <th style={{ ...th, textAlign: "right" }}>손실 평균</th>
                  </tr>
                </thead>
                <tbody>
                  {negatives.map((r) => (
                    <tr
                      key={r.ticker}
                      style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                    >
                      <td style={td}>
                        <code style={{ fontSize: "0.72rem" }}>{r.ticker}</code>
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--color-text-muted)" }}>
                        {r.count}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          color: "var(--quant-down)",
                          fontWeight: 600,
                        }}
                      >
                        {r.avg_return_pct.toFixed(2)}%
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {(r.win_rate * 100).toFixed(0)}%
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--quant-up)" }}>
                        {r.n_pos > 0 ? `+${r.avg_pos_return_pct.toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--quant-down)" }}>
                        {r.n_neg > 0 ? `${r.avg_neg_return_pct.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p
            style={{
              marginTop: "0.85rem",
              fontSize: "0.72rem",
              color: "var(--color-text-faint)",
              lineHeight: 1.55,
            }}
          >
            n이 1~2인 종목은 샘플 편향 가능성이 높습니다. 이익 배수(PF) =
            이익 평균 ÷ |손실 평균|. 상위 {TOP_N}종목만 표시됩니다.
          </p>
        </>
      )}
    </section>
  );
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "0.3rem 0.35rem",
  color: "var(--color-text-muted)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--color-border-subtle)",
};

const td: CSSProperties = {
  padding: "0.28rem 0.35rem",
  verticalAlign: "middle",
  color: "var(--color-text)",
};
