"use client";

import { useEffect, useState } from "react";

const DUMMY_VALUE = 1240;
const maxValue = 2000;

interface SupplyDemandCardProps {
  /** ISIN (e.g. KR7000020008). 있으면 API에서 실데이터 조회 */
  symbol?: string;
  /** YYYYMMDD. symbol과 함께 있어야 조회 */
  date?: string;
}

export function SupplyDemandCard({ symbol, date }: SupplyDemandCardProps) {
  const [value, setValue] = useState<number | null>(DUMMY_VALUE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol || !date) {
      setValue(DUMMY_VALUE);
      return;
    }
    setLoading(true);
    fetch(`/api/quant/scores?date=${date}&symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.foreign_net_millions != null) {
          setValue(d.foreign_net_millions);
        }
      })
      .catch(() => setValue(DUMMY_VALUE))
      .finally(() => setLoading(false));
  }, [symbol, date]);

  const displayValue = value ?? DUMMY_VALUE;
  const isPositive = displayValue >= 0;
  const barWidth = (Math.min(Math.abs(displayValue), maxValue) / maxValue) * 100;

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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.8125rem", color: "#4b5563", fontWeight: 500 }}>
              현재 수급 강도 {loading && <span style={{ color: "#9ca3af" }}>(조회중)</span>}
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: isPositive ? "#2563eb" : "#dc2626",
              }}
            >
              {isPositive ? "+" : ""}
              {displayValue.toLocaleString()}
            </div>
          </div>
          <div style={{ width: "100%", height: "8px", backgroundColor: "#f3f4f6", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${barWidth}%`,
                height: "100%",
                backgroundColor: isPositive ? "#2563eb" : "#dc2626",
                borderRadius: "4px",
                transition: "width 0.5s ease-out",
              }}
            />
          </div>
        </div>
      </div>
      
      <p style={{ fontSize: "0.6875rem", color: "#94a3b8", marginTop: "1rem", textAlign: "center" }}>
        최근 1시간 외국인 수급 패턴 AI 추정치
      </p>
    </div>
  );
}
