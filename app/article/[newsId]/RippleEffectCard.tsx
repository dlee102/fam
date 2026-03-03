"use client";

const RIPPLE_DATA = [
  { name: "삼성전자", relation: "주요 고객사", score: 88, type: "Upstream" },
  { name: "SK하이닉스", relation: "경쟁사 동향", score: 72, type: "Peer" },
  { name: "솔브레인", relation: "소재 공급망", score: 94, type: "Downstream" },
  { name: "리노공업", relation: "검사 소켓", score: 65, type: "Downstream" },
];

export function RippleEffectCard() {
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
      <div style={{ marginBottom: "1rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
          섹터 전이 효과 (Ripple Effect)
        </h3>
        <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
          공급망 및 경쟁사 퀀트 점수 분석
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {RIPPLE_DATA.map((item) => (
          <div 
            key={item.name} 
            style={{ 
              padding: "0.75rem", 
              backgroundColor: "#f8fafc", 
              borderRadius: "6px",
              border: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>{item.name}</span>
                <span 
                  style={{ 
                    fontSize: "0.625rem", 
                    padding: "1px 4px", 
                    borderRadius: "3px", 
                    backgroundColor: item.type === "Upstream" ? "#dcfce7" : item.type === "Peer" ? "#fef9c3" : "#dbeafe",
                    color: item.type === "Upstream" ? "#166534" : item.type === "Peer" ? "#854d0e" : "#1e40af"
                  }}
                >
                  {item.type}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>{item.relation}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.625rem", color: "#94a3b8" }}>퀀트 점수</div>
              <div 
                style={{ 
                  fontSize: "1rem", 
                  fontWeight: 700, 
                  color: item.score >= 80 ? "#059669" : item.score >= 60 ? "#d97706" : "#dc2626" 
                }}
              >
                {item.score}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
