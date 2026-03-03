"use client";

const SUPPLY_DATA = [
  { label: "외국인 수급 AI 모델", value: 1240, color: "#2563eb" },
];

export function SupplyDemandCard() {
  const maxValue = 2000; // 기준값 설정
  
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
          외국인 수급 AI 모델
        </h3>
        <span style={{ fontSize: "0.6875rem", color: "#9ca3af" }}>단위: 백만</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {SUPPLY_DATA.map((item) => {
          const isPositive = item.value >= 0;
          const barWidth = (Math.min(Math.abs(item.value), maxValue) / maxValue) * 100;
          
          return (
            <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.8125rem", color: "#4b5563", fontWeight: 500 }}>현재 수급 강도</div>
                <div 
                  style={{ 
                    fontSize: "1rem", 
                    fontWeight: 700,
                    color: isPositive ? "#2563eb" : "#dc2626"
                  }}
                >
                  {isPositive ? "+" : ""}{item.value.toLocaleString()}
                </div>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#f3f4f6", borderRadius: "4px", overflow: "hidden" }}>
                <div 
                  style={{ 
                    width: `${barWidth}%`, 
                    height: "100%", 
                    backgroundColor: item.color,
                    borderRadius: "4px",
                    transition: "width 0.5s ease-out"
                  }} 
                />
              </div>
            </div>
          );
        })}
      </div>
      
      <p style={{ fontSize: "0.6875rem", color: "#94a3b8", marginTop: "1rem", textAlign: "center" }}>
        최근 1시간 외국인 수급 패턴 AI 추정치
      </p>
    </div>
  );
}
