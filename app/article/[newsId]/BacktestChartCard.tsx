"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { sb, qLabel } from "./sidebar-tokens";

const BACKTEST_DATA = [
  { day: "발행일", value: 0 },
  { day: "D+1", value: 1.2 },
  { day: "D+2", value: 0.8 },
  { day: "D+3", value: 2.5 },
  { day: "D+4", value: 4.1 },
  { day: "D+5", value: 3.8 },
];
const AVG_RETURN = 3.8;

export function BacktestChartCard() {
  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.625rem",
          gap: "0.75rem",
        }}
      >
        <div>
          <div style={{ ...qLabel, marginBottom: "0.25rem" }}>유사 기사 백테스트</div>
          <p style={{ fontSize: "0.75rem", color: sb.faint, margin: 0, lineHeight: 1.45 }}>
            유사 호재군 · 이후 5거래일 누적
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "0.6875rem", color: sb.faint, fontWeight: 500 }}>평균</div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: sb.text,
              letterSpacing: "-0.02em",
            }}
          >
            +{AVG_RETURN}%
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: 116 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={BACKTEST_DATA} margin={{ top: 6, right: 6, left: 0, bottom: 4 }}>
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
              stroke={sb.chartLineAlt}
              strokeWidth={2}
              dot={{ fill: sb.chartLineAlt, r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: sb.chartLineAlt }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
