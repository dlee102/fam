"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { sb, qLabel } from "./sidebar-tokens";

const CHART_DATA = [
  { day: "D-3", value: 0 },
  { day: "D-2", value: 2 },
  { day: "D-1", value: -1 },
  { day: "발행일", value: 4 },
  { day: "D+1", value: 3 },
  { day: "D+2", value: 6 },
  { day: "D+3", value: 5 },
  { day: "D+4", value: 8.5 },
];
const ISSUE_DATE = "2025.02.01";
const RETURN_RATE = 8.5;

export function ReturnChartCard() {
  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div style={{ ...qLabel, marginBottom: "0.5rem" }}>발행일 대비 수익률</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.625rem",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ color: sb.faint }}>기준 {ISSUE_DATE}</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: "1rem",
            color: RETURN_RATE >= 0 ? sb.up : sb.down,
            letterSpacing: "-0.02em",
          }}
        >
          {RETURN_RATE >= 0 ? "+" : ""}
          {RETURN_RATE}%
        </span>
      </div>
      <div style={{ width: "100%", height: 104 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={CHART_DATA} margin={{ top: 6, right: 6, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 6" stroke={sb.grid} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: sb.muted }}
              axisLine={{ stroke: sb.border }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: sb.muted }}
              tickFormatter={(v) => `${v}%`}
              width={32}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              x="발행일"
              stroke={sb.refLine}
              strokeDasharray="4 4"
              strokeWidth={1.25}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                `${value != null ? (value >= 0 ? "+" : "") + value + "%" : "—"}`,
                "수익률",
              ]}
              contentStyle={{
                fontSize: "0.75rem",
                borderRadius: 8,
                border: `1px solid ${sb.border}`,
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={sb.chartLine}
              strokeWidth={2}
              dot={{ fill: sb.chartLine, r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: sb.chartLine }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
