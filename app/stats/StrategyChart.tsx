"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

type StrategyStats = {
  strategy: string;
  win_rate_1d?: number | null;
  avg_ret_1d?: number | null;
  win_rate_5d?: number | null;
  avg_ret_5d?: number | null;
};

export function StrategyChart({ data }: { data: StrategyStats[] }) {
  const strategyLabels: Record<string, string> = {
    Baseline: "시장 평균",
    "Strategy A": "뉴스당일 거래량 3배 이상 (과열)",
    "Strategy B": "뉴스당일 갭상승 2%+ 양봉 (급등)",
    "Strategy C": "직전 5일 -5%+ 하락 후 뉴스당일 양봉 (과매도 반등)",
    "Strategy D": "뉴스당일 거래량 1.5~3배·주가 1~5% 상승",
  };
  const displayName = (s: string) => strategyLabels[s] ?? s.replace("Strategy ", "");

  const winRateData = data.map((d) => ({
    name: displayName(d.strategy),
    "1일차": (d.win_rate_1d ?? 0) * 100,
    "5일차": (d.win_rate_5d ?? 0) * 100,
  }));

  const returnData = data.map((d) => ({
    name: displayName(d.strategy),
    "1일차": (d.avg_ret_1d ?? 0) * 100,
    "5일차": (d.avg_ret_5d ?? 0) * 100,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      <div style={{ height: "320px", minWidth: 0, width: "100%" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "1rem" }}>
          전략별 승률 (Win Rate, %)
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={winRateData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={14} tickLine={false} axisLine={false} />
            <YAxis fontSize={14} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
            <Tooltip 
                formatter={(value: any) => [`${Number(value || 0).toFixed(1)}%`, ""]}
                contentStyle={{ fontSize: "12px" }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="1일차" fill="#94a3b8" radius={0} />
            <Bar dataKey="5일차" fill="#475569" radius={0} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: "320px", minWidth: 0, width: "100%" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "1rem" }}>
          전략별 평균 수익률 (Avg Return, %)
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={returnData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={14} tickLine={false} axisLine={false} />
            <YAxis fontSize={14} tickLine={false} axisLine={false} unit="%" />
            <Tooltip 
                formatter={(value: any) => [`${Number(value || 0).toFixed(2)}%`, ""]}
                contentStyle={{ fontSize: "12px" }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="1일차" fill="#94a3b8" radius={0}>
                {returnData.map((entry, index) => (
                    <Cell key={`cell-1d-${index}`} fill={entry["1일차"] >= 0 ? "#64748b" : "#94a3b8"} />
                ))}
            </Bar>
            <Bar dataKey="5일차" fill="#475569" radius={0}>
                {returnData.map((entry, index) => (
                    <Cell key={`cell-5d-${index}`} fill={entry["5일차"] >= 0 ? "#334155" : "#64748b"} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
