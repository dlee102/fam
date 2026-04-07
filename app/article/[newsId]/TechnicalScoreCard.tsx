"use client";

import { useEffect, useState } from "react";
import { sb, qLabel } from "./sidebar-tokens";

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

function scoreLevel(score: number): "up" | "down" | "neutral" {
  if (score >= 80) return "up";
  if (score < 40) return "down";
  return "neutral";
}

function scoreToneColor(level: "up" | "down" | "neutral"): string {
  if (level === "up") return sb.up;
  if (level === "down") return sb.down;
  return sb.text;
}

function statusBadgeBg(level: "up" | "down" | "neutral"): string {
  if (level === "up") return "color-mix(in srgb, var(--quant-up) 16%, transparent)";
  if (level === "down") return "color-mix(in srgb, var(--quant-down) 16%, transparent)";
  return sb.grid;
}

function statusLabel(score: number): string {
  if (score >= 80) return "강세";
  if (score >= 60) return "우호";
  if (score >= 40) return "중립";
  return "약세";
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

  const level = scoreLevel(data.totalScore);
  const tone = scoreToneColor(level);

  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          gap: "0.75rem",
        }}
      >
        <div style={qLabel}>기술 점수</div>
        <div
          style={{
            display: "inline-flex",
            padding: "3px",
            borderRadius: 10,
            backgroundColor: sb.grid,
            gap: 2,
          }}
        >
          {(["2d", "5d", "10d"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                padding: "5px 10px",
                fontSize: "0.6875rem",
                fontWeight: 600,
                fontFamily: "inherit",
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                backgroundColor: period === p ? sb.surface : "transparent",
                color: period === p ? sb.text : sb.muted,
                boxShadow: period === p ? "var(--quant-segment-shadow)" : "none",
                transition: "background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.75rem", color: sb.faint, marginBottom: "0.25rem" }}>
          {data.name}
          {loading && <span style={{ marginLeft: "0.35rem", color: sb.muted }}>조회 중</span>}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              color: sb.text,
              letterSpacing: "-0.03em",
            }}
          >
            {data.totalScore}
          </span>
          <span style={{ fontSize: "0.8125rem", color: sb.faint }}>/ 100</span>
          <span
            style={{
              fontSize: "0.8125rem",
              color: tone,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 9999,
              backgroundColor: statusBadgeBg(level),
            }}
          >
            {statusLabel(data.totalScore)}
          </span>
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
              <span style={{ color: sb.muted }}>{item.label}</span>
              <span style={{ color: sb.text, fontWeight: 600 }}>{item.score}</span>
            </div>
            <div
              style={{
                height: "5px",
                backgroundColor: sb.grid,
                borderRadius: 9999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${item.score}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)",
                  borderRadius: 9999,
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
