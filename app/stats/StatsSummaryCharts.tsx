"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const PIPELINE_COLORS = ["#0d9488", "#94a3b8", "#cbd5e1"];
const BAR_FILL = "#0f766e";

export type PipelineSlice = {
  analyzed: number;
  skippedNoData: number;
  skippedNoFuture: number;
};

export type EntryWinRow = {
  label: string;
  winRatePct: number;
};

type Props = {
  pipeline: PipelineSlice | null;
  entryWinRateAt7d: EntryWinRow[] | null;
};

export function StatsSummaryCharts({ pipeline, entryWinRateAt7d }: Props) {
  const pieData =
    pipeline &&
    (pipeline.analyzed > 0 ||
      pipeline.skippedNoData > 0 ||
      pipeline.skippedNoFuture > 0)
      ? [
          { name: "분석 반영 쌍", value: pipeline.analyzed },
          { name: "가격데이터 부족 제외", value: pipeline.skippedNoData },
          { name: "종가 미도래 등 제외", value: pipeline.skippedNoFuture },
        ]
      : null;

  const barData =
    entryWinRateAt7d && entryWinRateAt7d.length > 0 ? entryWinRateAt7d : null;

  if (!pieData && !barData) return null;

  return (
    <div
      className="stats-summary-charts"
      style={{
        display: "grid",
        gap: "32px",
        marginTop: "32px",
      }}
    >
      {pieData && (
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 12px", color: "#1a1a1a" }}>
            데이터 구성 (기사–종목 쌍)
          </h3>
          <p style={{ fontSize: "12px", color: "#737373", margin: "0 0 16px", lineHeight: 1.5 }}>
            유효 쌍과 제외 건수 비중입니다.
          </p>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} stroke="#fff" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | undefined) => [`${v ?? 0}건`, ""]}
                  contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e5e5" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {barData && (
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 12px", color: "#1a1a1a" }}>
            입장 시점별 승률 (보유 7거래일)
          </h3>
          <p style={{ fontSize: "12px", color: "#737373", margin: "0 0 16px", lineHeight: 1.5 }}>
            보유 7거래일 고정, 입장 정의(A~E)별 승률(5분봉 기반 entry_hold_stats).
          </p>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#525252" }} tickLine={false} axisLine={{ stroke: "#e5e5e5" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#525252" }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                  domain={[0, 100]}
                  width={36}
                />
                <Tooltip
                  formatter={(v: number | undefined) => [`${Number(v ?? 0).toFixed(1)}%`, "승률"]}
                  contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e5e5" }}
                />
                <Bar dataKey="winRatePct" name="승률" fill={BAR_FILL} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
