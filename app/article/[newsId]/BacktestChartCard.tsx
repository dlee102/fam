"use client";

const BACKTEST_DATA = [0, 1.2, 0.8, 2.5, 4.1, 3.8]; // D+0 to D+5
const AVG_RETURN = 3.8;

export function BacktestChartCard() {
  const max = Math.max(...BACKTEST_DATA, 5);
  const min = Math.min(...BACKTEST_DATA, -1);
  const range = max - min || 1;
  const width = 260;
  const height = 80;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = BACKTEST_DATA.map((val, i) => {
    const x = padding.left + (i / (BACKTEST_DATA.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((val - min) / range) * chartHeight;
    return { x, y };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

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

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "80px", display: "block" }}>
        {/* Grid lines */}
        <line x1={padding.left} y1={padding.top + chartHeight - ((0 - min) / range) * chartHeight} x2={width - padding.right} y2={padding.top + chartHeight - ((0 - min) / range) * chartHeight} stroke="#e2e8f0" strokeWidth="1" />
        
        <path
          d={pathD}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#2563eb" />
        ))}
      </svg>
      
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "#94a3b8", marginTop: "0.5rem" }}>
        <span>발행일</span>
        <span>D+1</span>
        <span>D+2</span>
        <span>D+3</span>
        <span>D+4</span>
        <span>D+5</span>
      </div>
    </div>
  );
}
