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
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>
            과거 유사 기사 백테스트
          </h3>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            유사 호재 발생 후 5일간 흐름
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>평균 수익률</div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#2563eb" }}>+{AVG_RETURN}%</div>
        </div>
      </div>

      <div style={{ width: "100%", height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={BACKTEST_DATA} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={(v) => `${v}%`}
              width={28}
            />
            <Tooltip
              formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "수익률"]}
              contentStyle={{ fontSize: "0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: "#2563eb", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
