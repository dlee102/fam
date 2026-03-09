"use client";

import { useEffect, useState } from "react";

type Period = "2d" | "5d" | "10d";

interface ScoreData {
  name: string;
  totalScore: number;
  breakdown: {
    label: string;
    score: number;
    weight: number;
  }[];
}

const DUMMY_DATA: Record<Period, ScoreData> = {
  "2d": {
    name: "Short Pulse Score",
    totalScore: 82,
    breakdown: [
      { label: "모멘텀", score: 85, weight: 30 },
      { label: "추세", score: 70, weight: 30 },
      { label: "유동성", score: 90, weight: 20 },
      { label: "거래량", score: 80, weight: 20 },
    ],
  },
  "5d": {
    name: "Momentum Score",
    totalScore: 65,
    breakdown: [
      { label: "모멘텀", score: 60, weight: 30 },
      { label: "추세", score: 75, weight: 30 },
      { label: "유동성", score: 65, weight: 20 },
      { label: "거래량", score: 70, weight: 20 },
    ],
  },
  "10d": {
    name: "Trend Score",
    totalScore: 48,
    breakdown: [
      { label: "모멘텀", score: 40, weight: 30 },
      { label: "추세", score: 55, weight: 30 },
      { label: "유동성", score: 45, weight: 20 },
      { label: "거래량", score: 50, weight: 20 },
    ],
  },
};

interface TechnicalScoreCardProps {
  symbol?: string;
  date?: string;
}

export function TechnicalScoreCard({ symbol, date }: TechnicalScoreCardProps) {
  const [period, setPeriod] = useState<Period>("5d");
  const [data, setData] = useState<ScoreData>(DUMMY_DATA["5d"]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol || !date) {
      setData(DUMMY_DATA[period]);
      return;
    }
    setLoading(true);
    fetch(`/api/quant/scores?date=${date}&symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        const mom = d.momentum ?? 50;
        const trend = d.trend ?? 50;
        const spread = d.spread ?? 50;
        const vol = d.volume ?? 50;
        const breakdown = [
          { label: "모멘텀", score: Math.round(mom), weight: 30 },
          { label: "추세", score: Math.round(trend), weight: 30 },
          { label: "유동성", score: Math.round(spread), weight: 20 },
          { label: "거래량", score: Math.round(vol), weight: 20 },
        ];
        const totalScore = Math.round(
          (mom * 30 + trend * 30 + spread * 20 + vol * 20) / 100
        );
        setData({
          name: DUMMY_DATA[period].name,
          totalScore,
          breakdown,
        });
      })
      .catch(() => setData(DUMMY_DATA[period]))
      .finally(() => setLoading(false));
  }, [symbol, date]);

  useEffect(() => {
    if (symbol && date) {
      setData((prev) => ({ ...prev, name: DUMMY_DATA[period].name }));
    } else {
      setData(DUMMY_DATA[period]);
    }
  }, [period, symbol, date]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#059669"; // Strong Positive
    if (score >= 60) return "#10b981"; // Positive
    if (score >= 40) return "#d97706"; // Neutral
    return "#dc2626"; // Negative
  };

  const getStatusText = (score: number) => {
    if (score >= 80) return "매우 긍정";
    if (score >= 60) return "긍정";
    if (score >= 40) return "중립";
    return "부정";
  };

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "#1a1a1a",
            margin: 0,
          }}
        >
          기술적 지표 분석
        </h3>
        <div
          style={{
            display: "flex",
            backgroundColor: "#f3f4f6",
            padding: "2px",
            borderRadius: "6px",
          }}
        >
          {(["2d", "5d", "10d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "4px 8px",
                fontSize: "0.75rem",
                fontWeight: 500,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: period === p ? "#fff" : "transparent",
                color: period === p ? "#1a1a1a" : "#6b7280",
                boxShadow: period === p ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "1rem 0",
          borderBottom: "1px solid #f3f4f6",
          marginBottom: "1rem",
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
          {data.name} {loading && <span style={{ color: "#9ca3af" }}>(조회중)</span>}
        </div>
        <div
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: getScoreColor(data.totalScore),
          }}
        >
          {data.totalScore}
          <span style={{ fontSize: "1rem", fontWeight: 600, marginLeft: "2px" }}>점</span>
        </div>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: getScoreColor(data.totalScore),
            marginTop: "0.25rem",
          }}
        >
          {getStatusText(data.totalScore)}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {data.breakdown.map((item) => (
          <div key={item.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                marginBottom: "0.25rem",
              }}
            >
              <span style={{ color: "#4b5563", fontWeight: 500 }}>{item.label}</span>
              <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{item.score}점</span>
            </div>
            <div
              style={{
                height: "6px",
                backgroundColor: "#f3f4f6",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${item.score}%`,
                  height: "100%",
                  backgroundColor: getScoreColor(item.score),
                  borderRadius: "3px",
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
