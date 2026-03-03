"use client";

const CHART_DATA = [0, 2, -1, 4, 3, 6, 5, 8.5];
const ISSUE_DATE = "2025.02.01";
const RETURN_RATE = 8.5;

export function ReturnChartCard() {
  const max = Math.max(...CHART_DATA);
  const min = Math.min(...CHART_DATA);
  const range = max - min || 1;
  const width = 260;
  const height = 60;
  const padding = { top: 5, right: 5, bottom: 5, left: 5 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = CHART_DATA.map((val, i) => {
    const x = padding.left + (i / Math.max(1, CHART_DATA.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((val - min) / range) * chartHeight;
    return { x, y };
  });

  const midIdx = Math.floor(CHART_DATA.length / 2);
  const pathDBefore = points
    .slice(0, midIdx + 1)
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const pathDAfter = points
    .slice(midIdx)
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const issueLineX = padding.left + chartWidth / 2;

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
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "60px", display: "block" }}>
        <line
          x1={issueLineX}
          y1={padding.top}
          x2={issueLineX}
          y2={height - padding.bottom}
          stroke="#dc2626"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
        <path
          d={pathDBefore}
          fill="none"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathDAfter}
          fill="none"
          stroke="#dc2626"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
