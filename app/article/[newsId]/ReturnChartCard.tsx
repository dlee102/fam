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
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e5e5e5",
      }}
    >
      <h3
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          marginBottom: "0.75rem",
          color: "#1a1a1a",
        }}
      >
        발행일 기준 수익률
      </h3>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ color: "#737373" }}>기준일: {ISSUE_DATE}</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: RETURN_RATE >= 0 ? "#059669" : "#dc2626",
          }}
        >
          {RETURN_RATE >= 0 ? "+" : ""}
          {RETURN_RATE}%
        </span>
      </div>
      <div style={{ width: "100%", height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={CHART_DATA} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => `${v}%`}
              width={28}
            />
            <ReferenceLine
              x="발행일"
              stroke="#dc2626"
              strokeDasharray="4 2"
              strokeWidth={1.5}
            />
            <Tooltip
              formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "수익률"]}
              contentStyle={{ fontSize: "0.75rem", borderRadius: "6px", border: "1px solid #e5e7eb" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#059669"
              strokeWidth={2}
              dot={{ fill: "#059669", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
