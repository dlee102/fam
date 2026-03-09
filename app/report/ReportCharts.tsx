"use client";

import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";

const CHART_COLORS = {
  positive: "#059669",
  negative: "#dc2626",
  neutral: "#737373",
  blue: "#2563eb",
  amber: "#d97706",
};

// Highcharts 스타일: 얇은 선, 은은한 영역 채우기
const CHART_STROKE = "#475569";
const CHART_GRID = "#e6e6e6";
const CHART_AXIS = "#64748b";

// 백테스트 라인 차트 (Highcharts 스타일)
export function BacktestLineChart({
  data,
  avgReturn,
}: {
  data: { day: string; value: number }[];
  avgReturn: number;
}) {
  return (
    <div style={{ width: "100%", height: 200, marginTop: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="backtestArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CHART_STROKE} stopOpacity={0.2} />
              <stop offset="1" stopColor={CHART_STROKE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: CHART_AXIS }}
            axisLine={{ stroke: CHART_GRID }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_AXIS }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "수익률"]}
            contentStyle={{
              fontSize: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            labelFormatter={(label) => label}
          />
          <Area type="monotone" dataKey="value" fill="url(#backtestArea)" stroke="none" />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_STROKE}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div
        style={{
          textAlign: "right",
          fontSize: "0.75rem",
          color: CHART_STROKE,
          fontWeight: 600,
          marginTop: "0.25rem",
        }}
      >
        평균 수익률 +{avgReturn}%
      </div>
    </div>
  );
}

// 기술적 지표 레이더 차트 (학술적 스타일)
export function TechScoreRadarChart({
  data,
}: {
  data: { subject: string; score: number; fullMark: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 260, marginTop: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={CHART_GRID} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: CHART_AXIS }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: CHART_AXIS }}
          />
          <Radar
            name="점수"
            dataKey="score"
            stroke={CHART_STROKE}
            fill={CHART_STROKE}
            fillOpacity={0.15}
            strokeWidth={1.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 발행일 기준 수익률 - 라인 차트 (Highcharts 스타일, 발행일 기준선)
const RETURN_CHART_DATA = [
  { day: "D-3", value: 0 },
  { day: "D-2", value: 2 },
  { day: "D-1", value: -1 },
  { day: "발행일", value: 4 },
  { day: "D+1", value: 3 },
  { day: "D+2", value: 6 },
  { day: "D+3", value: 5 },
  { day: "D+4", value: 8.5 },
];

export function ReturnLineChart({ returnRate = 8.5 }: { returnRate?: number }) {
  return (
    <div style={{ width: "100%", height: 180, marginTop: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={RETURN_CHART_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="returnArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CHART_STROKE} stopOpacity={0.18} />
              <stop offset="1" stopColor={CHART_STROKE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: CHART_AXIS }}
            axisLine={{ stroke: CHART_GRID }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_AXIS }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <ReferenceLine
            x="발행일"
            stroke="#94a3b8"
            strokeDasharray="3 2"
            strokeWidth={1}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "수익률"]}
            contentStyle={{
              fontSize: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          />
          <Area type="monotone" dataKey="value" fill="url(#returnArea)" stroke="none" />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_STROKE}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div
        style={{
          textAlign: "right",
          fontSize: "0.75rem",
          color: CHART_STROKE,
          fontWeight: 600,
          marginTop: "0.25rem",
        }}
      >
        현재 수익률 {returnRate >= 0 ? "+" : ""}{returnRate}%
      </div>
    </div>
  );
}

// 섹터 전이 효과 바 차트 (학술적 스타일)
const RIPPLE_BAR_COLOR = "#475569";

export function RippleBarChart({
  data,
}: {
  data: { name: string; score: number; type: string }[];
}) {
  return (
    <div style={{ width: "100%", height: 180, marginTop: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 80, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "#475569" }}
            width={70}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${value != null ? value + "점" : "-"}`, "퀀트 점수"]}
            contentStyle={{
              fontSize: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          />
          <Bar dataKey="score" radius={[0, 2, 2, 0]} maxBarSize={10} fill={RIPPLE_BAR_COLOR} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 연관 종목 등락률 바 차트 (학술적 스타일)
const ACADEMIC_UP = "#475569";
const ACADEMIC_DOWN = "#94a3b8";

export function RelatedStocksBarChart({
  data,
}: {
  data: { symbol: string; name: string; change: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 200, marginTop: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="symbol"
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "등락률"]}
            contentStyle={{
              fontSize: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload ? `${(payload[0].payload as { name: string }).name} (${label})` : label
            }
          />
          <Bar dataKey="change" radius={[2, 2, 0, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.change >= 0 ? ACADEMIC_UP : ACADEMIC_DOWN}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 요약용 미니 백테스트 차트 (Highcharts 스타일)
const BACKTEST_DATA = [
  { day: "발행일", value: 0 },
  { day: "D+1", value: 1.2 },
  { day: "D+2", value: 0.8 },
  { day: "D+3", value: 2.5 },
  { day: "D+4", value: 4.1 },
  { day: "D+5", value: 3.8 },
];

export function MiniBacktestChart({ avgReturn = 3.8 }: { avgReturn?: number }) {
  return (
    <div style={{ width: "100%", height: 100, marginTop: "0.5rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={BACKTEST_DATA} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="miniBacktestArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CHART_STROKE} stopOpacity={0.15} />
              <stop offset="1" stopColor={CHART_STROKE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 9, fill: CHART_AXIS }} />
          <YAxis
            tick={{ fontSize: 9, fill: CHART_AXIS }}
            tickFormatter={(v) => `${v}%`}
            width={24}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "수익률"]}
            contentStyle={{ fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #e2e8f0" }}
          />
          <Area type="monotone" dataKey="value" fill="url(#miniBacktestArea)" stroke="none" />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_STROKE}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, stroke: "#fff", strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ textAlign: "right", fontSize: "0.75rem", color: CHART_STROKE, fontWeight: 600 }}>
        평균 +{avgReturn}%
      </div>
    </div>
  );
}

// 요약용 미니 수익률 차트 (Highcharts 스타일)
const RETURN_DATA = [
  { day: "D-2", value: 2 },
  { day: "D-1", value: -1 },
  { day: "발행일", value: 4 },
  { day: "D+1", value: 3 },
  { day: "D+2", value: 6 },
  { day: "D+4", value: 8.5 },
];

export function MiniReturnChart({ returnRate = 8.5 }: { returnRate?: number }) {
  return (
    <div style={{ width: "100%", height: 90, marginTop: "0.5rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={RETURN_DATA} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="miniReturnArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CHART_STROKE} stopOpacity={0.15} />
              <stop offset="1" stopColor={CHART_STROKE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 9, fill: CHART_AXIS }} />
          <YAxis
            tick={{ fontSize: 9, fill: CHART_AXIS }}
            tickFormatter={(v) => `${v}%`}
            width={24}
          />
          <ReferenceLine x="발행일" stroke="#94a3b8" strokeDasharray="3 2" strokeWidth={1} />
          <Tooltip
            formatter={(value: number | undefined) => [`${value != null ? (value >= 0 ? "+" : "") + value + "%" : "-"}`, "수익률"]}
            contentStyle={{ fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #e2e8f0" }}
          />
          <Area type="monotone" dataKey="value" fill="url(#miniReturnArea)" stroke="none" />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_STROKE}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, stroke: "#fff", strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div
        style={{
          textAlign: "right",
          fontSize: "0.75rem",
          color: CHART_STROKE,
          fontWeight: 600,
        }}
      >
        현재 {returnRate >= 0 ? "+" : ""}{returnRate}%
      </div>
    </div>
  );
}

// AI 점수 프로그레스 (간단한 시각화)
export function AIScoreProgress({ score = 80 }: { score?: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped >= 70 ? CHART_COLORS.positive : clamped >= 40 ? CHART_COLORS.amber : CHART_COLORS.negative;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          height: 16,
          backgroundColor: "#f3f4f6",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 8,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "0.5rem",
          fontSize: "0.875rem",
        }}
      >
        <span style={{ fontWeight: 700, color }}>{clamped}점</span>
        <span
          style={{
            fontWeight: 600,
            color: CHART_COLORS.positive,
            padding: "0.2rem 0.5rem",
            backgroundColor: "#ecfdf5",
            borderRadius: 9999,
          }}
        >
          긍정
        </span>
      </div>
    </div>
  );
}

// Seeking Alpha 스타일 Quant Rating 바 (1 Strong Sell ~ 5 Strong Buy)
const RATING_STEPS = [
  { n: 1, label: "Strong Sell" },
  { n: 2, label: "Sell" },
  { n: 3, label: "Hold" },
  { n: 4, label: "Buy" },
  { n: 5, label: "Strong Buy" },
] as const;

export function QuantRatingBar({
  rating,
  score,
  compact,
}: {
  rating: 1 | 2 | 3 | 4 | 5;
  score?: number;
  compact?: boolean;
}) {
  const idx = rating - 1;
  const color =
    rating >= 4 ? CHART_COLORS.positive : rating <= 2 ? CHART_COLORS.negative : CHART_COLORS.amber;
  // 1~5 스케일에서 위치 (0~100%)
  const position = ((rating - 1) / 4) * 100;

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
        <span
          style={{
            padding: "0.2rem 0.5rem",
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "#fff",
            backgroundColor: color,
            borderRadius: 4,
          }}
        >
          {RATING_STEPS[idx].label}
        </span>
        {score != null && (
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#525252" }}>{score}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            padding: "0.25rem 0.5rem",
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#fff",
            backgroundColor: color,
            borderRadius: 4,
          }}
        >
          {RATING_STEPS[idx].label}
        </span>
        {score != null && (
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#525252" }}>{score}</span>
        )}
      </div>
      {/* 연속 바 + 위치 표시 (SA 스타일) */}
      <div style={{ position: "relative", marginBottom: "0.5rem" }}>
        <div
          style={{
            height: 12,
            backgroundColor: "#e5e7eb",
            borderRadius: 6,
            overflow: "visible",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${position}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid #fff",
              backgroundColor: color,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              zIndex: 1,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontSize: "0.625rem",
            color: "#9ca3af",
          }}
        >
          {RATING_STEPS.map((s) => (
            <span key={s.n} style={{ textAlign: "center" }}>
              <div>{s.n}</div>
              <div style={{ color: "#6b7280", fontWeight: 500 }}>{s.label}</div>
            </span>
          ))}
        </div>
      </div>
      <p
        style={{
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "#9ca3af",
          borderTop: "1px solid #f0f0f0",
          paddingTop: "0.75rem",
        }}
      >
        종합 퀀트 등급은 각 팩터 등급의 단순 평균이 아니라, 예측력이 높은 지표에 더 큰 가중치를 부여합니다.
      </p>
    </div>
  );
}

// Factor Grades 테이블 (Valuation, Growth, Profitability, Momentum, Revisions)
export function FactorGradesTable({
  grades,
}: {
  grades: { factor: string; now: string; m3?: string; m6?: string }[];
}) {
  const getGradeColor = (g: string) => {
    if (g.startsWith("A")) return CHART_COLORS.positive;
    if (g.startsWith("B")) return "#22c55e";
    if (g.startsWith("C")) return CHART_COLORS.amber;
    if (g.startsWith("D") || g === "F") return CHART_COLORS.negative;
    return "#737373";
  };

  return (
    <div
      style={{
        marginTop: "1rem",
        border: "1px solid #e5e5e5",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#fafafa" }}>
            <th
              style={{
                textAlign: "left",
                padding: "0.625rem 0.75rem",
                fontWeight: 600,
                color: "#525252",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              등급
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "0.625rem 0.75rem",
                fontWeight: 600,
                color: "#525252",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              현재
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "0.625rem 0.75rem",
                fontWeight: 600,
                color: "#525252",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              3개월 전
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "0.625rem 0.75rem",
                fontWeight: 600,
                color: "#525252",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              6개월 전
            </th>
          </tr>
        </thead>
        <tbody>
          {grades.map((row) => (
            <tr key={row.factor} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "0.625rem 0.75rem", color: "#1a1a1a", fontWeight: 500 }}>
                {row.factor}
              </td>
              <td style={{ textAlign: "center", padding: "0.625rem 0.75rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.2rem 0.4rem",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    backgroundColor: getGradeColor(row.now) + "20",
                    color: getGradeColor(row.now),
                    borderRadius: 4,
                  }}
                >
                  {row.now}
                </span>
              </td>
              <td style={{ textAlign: "center", padding: "0.625rem 0.75rem", color: "#525252" }}>
                {row.m3 ?? "-"}
              </td>
              <td style={{ textAlign: "right", padding: "0.625rem 0.75rem", color: "#525252" }}>
                {row.m6 ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 외국인 수급 게이지 바
export function ForeignFlowGauge({ value }: { value: number }) {
  const max = 2000;
  const absVal = Math.min(Math.abs(value), max);
  const pct = (absVal / max) * 100;
  const isPositive = value >= 0;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          height: 12,
          backgroundColor: "#f3f4f6",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: isPositive ? CHART_COLORS.blue : CHART_COLORS.negative,
            borderRadius: 6,
            marginLeft: isPositive ? 0 : "auto",
            marginRight: isPositive ? "auto" : 0,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "0.5rem",
          fontSize: "0.75rem",
          color: "#9ca3af",
        }}
      >
        <span>매도</span>
        <span>매수</span>
      </div>
    </div>
  );
}
