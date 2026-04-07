"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { backtestingPanelCard } from "../lib/ui-styles";
import type { HorizonEntrySeries } from "../lib/publish-horizon.types";
import { HORIZON_ENTRY_COLORS } from "./horizon-chart-data";

type Props = {
  entries: Record<string, HorizonEntrySeries>;
  available: string[];
};

type DecompRow = {
  day: number;
  gain: number | null;
  loss: number | null;
  net: number;
  win_rate: number;
  n_pos: number;
  n_neg: number;
  profit_factor: number | null;
};

export function GainLossDecompPanel({ entries, available }: Props) {
  const [selected, setSelected] = useState<string>(available[0] ?? "A");

  const { chartData, hasDecompData, summaryStats } = useMemo(() => {
    const pts = entries[selected]?.points ?? [];
    const rows: DecompRow[] = pts
      .filter((p) => p.n_pos != null && p.n_neg != null)
      .map((p) => {
        const gain = p.avg_pos_return_pct ?? null;
        const loss = p.avg_neg_return_pct ?? null;
        const pf =
          gain != null && loss != null && loss < 0
            ? Math.abs(gain / loss)
            : null;
        return {
          day: p.trading_day,
          gain,
          loss,
          net: p.avg_return_pct,
          win_rate: +(p.win_rate * 100).toFixed(2),
          n_pos: p.n_pos ?? 0,
          n_neg: p.n_neg ?? 0,
          profit_factor: pf,
        };
      });

    const validPF = rows.filter((r) => r.profit_factor != null);
    const avgGain =
      rows.length > 0
        ? rows.reduce((s, r) => s + (r.gain ?? 0), 0) / rows.length
        : null;
    const avgLoss =
      rows.length > 0
        ? rows.reduce((s, r) => s + (r.loss ?? 0), 0) / rows.length
        : null;
    const avgPF =
      validPF.length > 0
        ? validPF.reduce((s, r) => s + (r.profit_factor ?? 0), 0) /
          validPF.length
        : null;
    const avgWR =
      rows.length > 0
        ? rows.reduce((s, r) => s + r.win_rate, 0) / rows.length
        : null;

    return {
      chartData: rows,
      hasDecompData: rows.length > 0,
      summaryStats: { avgGain, avgLoss, avgPF, avgWR },
    };
  }, [entries, selected]);

  const color = HORIZON_ENTRY_COLORS[selected] ?? "var(--color-accent)";

  return (
    <section style={backtestingPanelCard}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem 1rem",
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
            손익 분해
          </div>
          <div
            style={{ fontSize: "0.72rem", color: "var(--color-text-faint)" }}
          >
            승 관측 평균 이익 vs 패 관측 평균 손실 · 진입별
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {available.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              style={{
                padding: "0.35rem 0.55rem",
                borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${HORIZON_ENTRY_COLORS[k] ?? "#888"}`,
                background:
                  selected === k
                    ? `${HORIZON_ENTRY_COLORS[k] ?? "#888"}20`
                    : "transparent",
                color:
                  selected === k
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
                  color: selected === k ? "var(--color-text)" : "var(--color-text-muted)",
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
                  marginTop: "0.12rem",
                  fontSize: "0.62rem",
                  opacity: 0.85,
                }}
              >
                시나리오 {k}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!hasDecompData ? (
        <p style={{ fontSize: "0.78rem", color: "var(--color-text-faint)" }}>
          손익 분해 데이터가 없습니다. 아래 명령어로 JSON을 재생성하세요.
          <br />
          <code style={{ fontSize: "0.72rem" }}>
            python3 scripts/entry_hold_analysis.py
          </code>
        </p>
      ) : (
        <>
          {/* Summary KPIs */}
          <div style={kpiRow}>
            {summaryStats.avgGain != null && (
              <KpiBox
                label="평균 이익 (승 관측)"
                value={`+${summaryStats.avgGain.toFixed(2)}%`}
                color="var(--quant-up)"
              />
            )}
            {summaryStats.avgLoss != null && (
              <KpiBox
                label="평균 손실 (패 관측)"
                value={`${summaryStats.avgLoss.toFixed(2)}%`}
                color="var(--quant-down)"
              />
            )}
            {summaryStats.avgPF != null && (
              <KpiBox
                label="이익 배수 (PF)"
                value={`${summaryStats.avgPF.toFixed(2)}×`}
                color={
                  summaryStats.avgPF >= 1
                    ? "var(--quant-up)"
                    : "var(--quant-down)"
                }
                note="PF = 평균이익 ÷ |평균손실|"
              />
            )}
            {summaryStats.avgWR != null && (
              <KpiBox
                label="평균 승률"
                value={`${summaryStats.avgWR.toFixed(1)}%`}
                color={
                  summaryStats.avgWR >= 50
                    ? "var(--quant-up)"
                    : "var(--color-text-muted)"
                }
                note="1~30거래일 단순 평균"
              />
            )}
          </div>

          {/* Chart */}
          <div style={{ width: "100%", height: 280, marginTop: "0.75rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-subtle)"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  label={{
                    value: "보유 거래일 (N)",
                    position: "insideBottom",
                    offset: -10,
                    style: { fill: "var(--color-text-muted)", fontSize: 11 },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  tickFormatter={(v) => `${v}%`}
                  width={52}
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--color-border-strong)"
                  strokeDasharray="4 3"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    const v = Number(value ?? 0);
                    if (name === "gain")
                      return [
                        `+${v.toFixed(3)}%`,
                        `승 관측 평균 이익 (n=${chartData.find((d) => d.gain === v)?.n_pos ?? ""})`,
                      ];
                    if (name === "loss")
                      return [
                        `${v.toFixed(3)}%`,
                        `패 관측 평균 손실 (n=${chartData.find((d) => d.loss === v)?.n_neg ?? ""})`,
                      ];
                    return [
                      `${v >= 0 ? "+" : ""}${v.toFixed(3)}%`,
                      "순 평균 수익",
                    ];
                  }}
                  labelFormatter={(d) => `${d}거래일`}
                />
                <Bar
                  dataKey="gain"
                  name="gain"
                  fill="var(--quant-up)"
                  opacity={0.65}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="loss"
                  name="loss"
                  fill="var(--quant-down)"
                  opacity={0.65}
                  radius={[0, 0, 2, 2]}
                />
                <Line
                  dataKey="net"
                  name="net"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: color }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.72rem",
              color: "var(--color-text-faint)",
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "var(--color-text-muted)" }}>
              초록 막대
            </strong>{" "}
            승 관측 평균 이익 ·{" "}
            <strong style={{ color: "var(--color-text-muted)" }}>
              빨간 막대
            </strong>{" "}
            패 관측 평균 손실 ·{" "}
            <strong style={{ color: "var(--color-text-muted)" }}>
              실선
            </strong>{" "}
            순 평균 수익. 이익 배수(PF) = 초록 ÷ |빨간|. PF &gt; 1이면 이익
            크기가 손실을 상회.
          </p>
        </>
      )}
    </section>
  );
}

function KpiBox({
  label,
  value,
  color,
  note,
}: {
  label: string;
  value: string;
  color: string;
  note?: string;
}) {
  return (
    <div
      style={{
        minWidth: 90,
        padding: "0.55rem 0.85rem",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-elevated, var(--color-surface))",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div
        style={{ fontSize: "0.68rem", color: "var(--color-text-faint)", marginBottom: "0.2rem" }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: "1.1rem", fontWeight: 700, color, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {note && (
        <div style={{ fontSize: "0.62rem", color: "var(--color-text-faint)", marginTop: "0.15rem" }}>
          {note}
        </div>
      )}
    </div>
  );
}

const kpiRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.6rem",
};
