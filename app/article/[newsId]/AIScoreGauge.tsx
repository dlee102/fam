"use client";

export function AIScoreGauge({ score = 80 }: { score?: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const percent = clamped / 100;
  const barColor = clamped >= 70 ? "#059669" : clamped >= 40 ? "#d97706" : "#dc2626";

  return (
    <div
      style={{
        marginBottom: "1.5rem",
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
          textAlign: "center",
        }}
      >
        AI 인텔리전스 종합 점수
      </h3>
      <div style={{ marginBottom: "0.5rem" }}>
        <div
          style={{
            height: "12px",
            backgroundColor: "#f3f4f6",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent * 100}%`,
              height: "100%",
              backgroundColor: barColor,
              borderRadius: "6px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.5rem",
        }}
      >
        <span style={{ fontSize: "1rem", fontWeight: 700, color: barColor }}>
          {clamped}점
        </span>
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#059669",
            padding: "0.2rem 0.6rem",
            backgroundColor: "#ecfdf5",
            borderRadius: "9999px",
          }}
        >
          긍정
        </span>
      </div>
    </div>
  );
}
