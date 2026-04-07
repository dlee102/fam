"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BacktestingStatCard } from "../components/BacktestingStatCard";
import { backtestingPanelCard } from "../lib/ui-styles";
import type { BacktestingSourceCounts } from "../lib/backtesting-source-counts.types";
import { resolveSampleSummary, type PublishHorizonFile } from "../lib/publish-horizon.types";
import {
  bestPointByReturn,
  buildHorizonChartRows,
  HORIZON_ENTRY_COLORS,
  HORIZON_ENTRY_ORDER,
  horizonEntryLegendName,
  horizonEntryTitle,
} from "./horizon-chart-data";
import { GainLossDecompPanel } from "./GainLossDecompPanel";
import { PublishHorizonSampleBanner } from "./PublishHorizonSampleBanner";
import { TickerAttributionPanel } from "./TickerAttributionPanel";

type Props = { data: PublishHorizonFile; sourceCounts: BacktestingSourceCounts };

export function PublishHorizonChart({ data, sourceCounts }: Props) {
  const sampleSummary = useMemo(() => resolveSampleSummary(data), [data]);
  const entries = data.entries ?? {};
  const available = HORIZON_ENTRY_ORDER.filter((k) => k in entries);
  const [visible, setVisible] = useState<Set<string>>(new Set(["A", "C"]));

  const toggle = (k: string) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        if (next.size === 1) return prev;
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });

  const chartData = buildHorizonChartRows(entries, visible);
  /** 차트 토글과 무관하게, 원시 표에는 JSON에 있는 시나리오 전부 표시 */
  const rawTableRows = useMemo(
    () => buildHorizonChartRows(entries, new Set(available)),
    [entries, available]
  );

  const aPoints = entries["A"]?.points ?? [];
  const cPoints = entries["C"]?.points ?? [];
  const bestA = bestPointByReturn(aPoints);
  const bestC = bestPointByReturn(cPoints);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PublishHorizonSampleBanner summary={sampleSummary} sourceCounts={sourceCounts} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.65rem",
        }}
      >
        {bestA && (
          <BacktestingStatCard
            label={horizonEntryTitle("A", entries.A?.label, "최대 수익 구간")}
            value={`+${bestA.avg_return_pct.toFixed(3)}%`}
            sub={`${bestA.trading_day}거래일 / n=${bestA.count}`}
            color="var(--color-accent)"
          />
        )}
        {bestC && (
          <BacktestingStatCard
            label={horizonEntryTitle("C", entries.C?.label, "최대 수익 구간")}
            value={`+${bestC.avg_return_pct.toFixed(3)}%`}
            sub={`${bestC.trading_day}거래일 / n=${bestC.count}`}
            color={HORIZON_ENTRY_COLORS.C}
          />
        )}
        {aPoints[0] && (
          <BacktestingStatCard
            label={horizonEntryTitle("A", entries.A?.label, "1거래일 평균 수익")}
            value={`${aPoints[0].avg_return_pct >= 0 ? "+" : ""}${aPoints[0].avg_return_pct.toFixed(3)}%`}
            sub={`승률 ${(aPoints[0].win_rate * 100).toFixed(1)}%`}
          />
        )}
        {cPoints[0] && (
          <BacktestingStatCard
            label={horizonEntryTitle("C", entries.C?.label, "1거래일 평균 수익")}
            value={`${cPoints[0].avg_return_pct >= 0 ? "+" : ""}${cPoints[0].avg_return_pct.toFixed(3)}%`}
            sub={`승률 ${(cPoints[0].win_rate * 100).toFixed(1)}%`}
          />
        )}
      </div>

      <section style={backtestingPanelCard}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem 1rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)" }}>
            발행일 기준 평균 수익률 (거래일 N일 보유)
          </span>
          {data.generated_at && (
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
              집계: {data.generated_at.slice(0, 10)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.1rem" }}>
          {available.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              style={{
                padding: "0.4rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${HORIZON_ENTRY_COLORS[k] ?? "#888"}`,
                background: visible.has(k) ? `${HORIZON_ENTRY_COLORS[k] ?? "#888"}18` : "transparent",
                color: visible.has(k) ? (HORIZON_ENTRY_COLORS[k] ?? "#888") : "var(--color-text-faint)",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.12s",
                textAlign: "left",
                maxWidth: "min(100%, 220px)",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: visible.has(k) ? "var(--color-text)" : "var(--color-text-muted)",
                  fontWeight: 600,
                  lineHeight: 1.35,
                }}
              >
                {entries[k]?.label ?? k}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "0.15rem",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  opacity: 0.85,
                }}
              >
                시나리오 {k}
              </span>
            </button>
          ))}
        </div>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                label={{
                  value: "보유 거래일 (N)",
                  position: "insideBottom",
                  offset: -8,
                  style: { fill: "var(--color-text-muted)", fontSize: 11 },
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                tickFormatter={(v) => `${v}%`}
                width={50}
              />
              <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeDasharray="4 3" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => {
                  const code = String(name ?? "");
                  const leg = horizonEntryLegendName(code, entries[code]?.label);
                  return [
                    `${Number(value ?? 0) >= 0 ? "+" : ""}${value ?? 0}%`,
                    `${leg} 평균 수익률`,
                  ];
                }}
                labelFormatter={(d) => `${d}거래일`}
              />
              {available
                .filter((k) => visible.has(k))
                .map((k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={k}
                    stroke={HORIZON_ENTRY_COLORS[k]}
                    strokeWidth={2}
                    dot={{ r: 2, fill: HORIZON_ENTRY_COLORS[k] }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "0.65rem",
            }}
          >
            승률 (%)
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  label={{
                    value: "보유 거래일 (N)",
                    position: "insideBottom",
                    offset: -8,
                    style: { fill: "var(--color-text-muted)", fontSize: 11 },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[35, 65]}
                  width={50}
                />
                <ReferenceLine
                  y={50}
                  stroke="var(--color-border-strong)"
                  strokeDasharray="4 3"
                  label={{
                    value: "50%",
                    position: "insideLeft",
                    style: { fill: "var(--color-text-faint)", fontSize: 10 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    const raw = String(name ?? "");
                    const code = raw.replace(/_wr$/, "");
                    const leg = horizonEntryLegendName(code, entries[code]?.label);
                    return [`${value ?? 0}%`, `${leg} 승률`];
                  }}
                  labelFormatter={(d) => `${d}거래일`}
                />
                {available
                  .filter((k) => visible.has(k))
                  .map((k) => (
                    <Line
                      key={`${k}_wr`}
                      type="monotone"
                      dataKey={`${k}_wr`}
                      name={`${k}_wr`}
                      stroke={HORIZON_ENTRY_COLORS[k]}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.definition ? (
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.75rem",
              color: "var(--color-text-faint)",
              lineHeight: 1.6,
            }}
          >
            {data.definition}
          </p>
        ) : null}
      </section>

      <section style={{ ...backtestingPanelCard, overflowX: "auto" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: "0.35rem",
          }}
        >
          원시 수치
        </div>
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.72rem",
            color: "var(--color-text-faint)",
            lineHeight: 1.5,
          }}
        >
          칸마다 위·평균 수익률, 아래·승률. 차트 토글과 달리 표는 데이터에 있는 모든 진입 시나리오를 항상
          표시합니다.
        </p>
        <table
          style={{
            width: "100%",
            minWidth: Math.max(320, 88 + available.length * 104),
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 72 }}>거래일</th>
              {available.map((k) => (
                <th key={k} style={{ ...thScenarioHead, borderBottomColor: HORIZON_ENTRY_COLORS[k] ?? "var(--color-border-subtle)" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: HORIZON_ENTRY_COLORS[k] }}>{k}</span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "0.25rem",
                      fontSize: "0.65rem",
                      fontWeight: 500,
                      color: "var(--color-text-muted)",
                      lineHeight: 1.35,
                      maxWidth: 120,
                    }}
                    title={entries[k]?.label ?? k}
                  >
                    {shortEntryLabel(entries[k]?.label, k)}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "0.35rem",
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      color: "var(--color-text-faint)",
                      textTransform: "uppercase",
                    }}
                  >
                    수익 · 승률
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rawTableRows.map((row, idx) => (
              <tr
                key={row.day}
                style={{
                  borderBottom: "1px solid var(--color-border-subtle)",
                  background:
                    idx % 2 === 1
                      ? "color-mix(in srgb, var(--color-text) 3.5%, var(--color-surface))"
                      : undefined,
                }}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: "var(--color-text-muted)" }}>{row.day}일</td>
                {available.map((k) => (
                  <td key={k} style={{ ...tdMetric, verticalAlign: "middle" }}>
                    <RawMetricCell ret={row[k] as number | null} winRate={row[`${k}_wr`] as number | null} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <GainLossDecompPanel entries={entries} available={available} />

      <TickerAttributionPanel
        tickerAttribution={data.ticker_attribution}
        entries={entries}
        available={available}
      />
    </div>
  );
}

/** 표 헤더 줄임: 긴 진입 정의에서 반복되는 "5분봉"만 제거 */
function shortEntryLabel(label: string | undefined, code: string): string {
  const t = label?.trim();
  if (!t) return code;
  return t.replace(/5분봉\s*/g, "");
}

function RawMetricCell({ ret, winRate }: { ret: number | null; winRate: number | null }) {
  if (ret == null && winRate == null) {
    return (
      <span style={{ color: "var(--color-text-faint)", fontSize: "0.8125rem" }}>—</span>
    );
  }
  const retColor =
    ret == null ? "var(--color-text-faint)" : ret >= 0 ? "var(--quant-up)" : "var(--quant-down)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.18rem",
        alignItems: "flex-end",
        padding: "0.12rem 0",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: retColor, lineHeight: 1.25 }}>
        {ret != null ? `${ret >= 0 ? "+" : ""}${ret.toFixed(3)}%` : "—"}
      </span>
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          lineHeight: 1.2,
        }}
      >
        {winRate != null ? (
          <>
            <span style={{ color: "var(--color-text-faint)", fontWeight: 500, marginRight: "0.22rem" }}>
              승
            </span>
            {winRate.toFixed(1)}%
          </>
        ) : (
          <span style={{ color: "var(--color-text-faint)" }}>—</span>
        )}
      </span>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.4rem 0.5rem",
  color: "var(--color-text-muted)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "0.35rem 0.5rem",
  verticalAlign: "middle",
  color: "var(--color-text)",
};

const thScenarioHead: CSSProperties = {
  textAlign: "left",
  padding: "0.45rem 0.4rem 0.5rem",
  verticalAlign: "bottom",
  borderBottom: "2px solid var(--color-border-subtle)",
  fontWeight: 600,
};

const tdMetric: CSSProperties = {
  padding: "0.4rem 0.45rem",
  textAlign: "right",
  color: "var(--color-text)",
};
