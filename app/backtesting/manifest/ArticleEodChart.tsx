"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sb } from "@/app/article/[newsId]/sidebar-tokens";
import type { PerArticleManifestRow } from "../per-article-manifest";

type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
};

type EodData = {
  article_id: string;
  ticker: string;
  t0_kst: string;
  bars: Bar[];
};

type DisplayMode = "price" | "return";

type ChartPoint = {
  day: number;
  date: string;
  close: number;
  value: number;
};

function buildChartPoints(bars: Bar[], t0_kst: string, mode: DisplayMode): ChartPoint[] {
  const t0idx = bars.findIndex((b) => b.date >= t0_kst);
  const anchor = t0idx === -1 ? Math.floor(bars.length / 2) : t0idx;
  // 기사 발행 시각(장 개장 전)을 0% 기준으로: t0 시가(open)를 사용
  const refPrice = bars[anchor]?.open ?? bars[anchor]?.close ?? 1;

  return bars
    .map((b, i) => {
      const day = i - anchor;
      const value = mode === "return"
        ? ((b.close - refPrice) / refPrice) * 100
        : b.close;
      return { day, date: b.date, close: b.close, value };
    })
    .filter((p) => p.day >= -20 && p.day <= 20);
}

function formatValue(v: number, mode: DisplayMode) {
  if (mode === "return") return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  return v.toLocaleString("ko-KR");
}

export function ArticleEodChart({ row }: { row: PerArticleManifestRow }) {
  const [data, setData] = useState<EodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DisplayMode>("return");

  useEffect(() => {
    if (!row.eod_ok || !row.eod_path) {
      setError("EOD 데이터 없음");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/backtesting/eod-bars?path=${encodeURIComponent(row.eod_path)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: EodData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [row.eod_path, row.eod_ok]);

  const points = data ? buildChartPoints(data.bars, data.t0_kst, mode) : [];
  const isPositive = points.length > 0 && points[points.length - 1].value >= points[0].value;
  const lineColor = mode === "return"
    ? (isPositive ? sb.up : sb.down)
    : sb.chartLine;

  return (
    <div
      style={{
        padding: "1rem 1.25rem 0.75rem",
        backgroundColor: "var(--quant-canvas)",
        borderTop: `1px solid ${sb.grid}`,
      }}
    >
      {/* header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.65rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ fontSize: "0.8rem", color: sb.muted }}>
          <strong style={{ color: sb.text }}>{row.ticker}</strong>
          <span style={{ color: sb.faint, margin: "0 0.4rem" }}>·</span>
          발행일 시가 기준 ±20 거래일
          <span style={{ color: sb.faint, margin: "0 0.4rem" }}>·</span>
          <span style={{ color: sb.faint }}>t0: {row.t0_kst}</span>
        </div>

        {/* mode toggle */}
        <div
          style={{
            display: "inline-flex",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${sb.border}`,
            overflow: "hidden",
          }}
        >
          {(["return", "price"] as DisplayMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "0.25rem 0.65rem",
                fontSize: "0.75rem",
                fontWeight: mode === m ? 700 : 400,
                background: mode === m ? "var(--color-accent)" : "transparent",
                color: mode === m ? "#fff" : sb.muted,
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              {m === "return" ? "수익률 %" : "종가"}
            </button>
          ))}
        </div>
      </div>

      {/* chart body */}
      {loading && (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: sb.faint, fontSize: "0.8rem" }}>
          로딩 중…
        </div>
      )}
      {error && (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: sb.down, fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
      {!loading && !error && points.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={sb.grid} vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: sb.faint, fontSize: 11 }}
              tickFormatter={(v: number) => (v === 0 ? "t0" : `${v > 0 ? "+" : ""}${v}`)}
              interval={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: sb.faint, fontSize: 11 }}
              width={mode === "return" ? 52 : 64}
              tickFormatter={(v: number) =>
                mode === "return" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : v.toLocaleString("ko-KR")
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--quant-surface)",
                border: `1px solid ${sb.border}`,
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
                color: sb.text,
              }}
              labelFormatter={(label) => {
                const n = typeof label === "number" ? label : Number(label);
                if (n === 0) return `t0 (발행일)`;
                if (!Number.isFinite(n)) return String(label ?? "");
                return `${n > 0 ? "+" : ""}${n}일`;
              }}
              formatter={(value, _name, props) => {
                const num =
                  value === undefined
                    ? undefined
                    : typeof value === "number"
                      ? value
                      : Number(value);
                const text =
                  num === undefined || !Number.isFinite(num) ? "—" : formatValue(num, mode);
                return [
                  text,
                  `${(props as { payload?: ChartPoint })?.payload?.date ?? ""} 종가`,
                ];
              }}
            />
            <ReferenceLine x={0} stroke={sb.refLine} strokeDasharray="4 3" strokeWidth={1.5} />
            {mode === "return" && (
              <ReferenceLine y={0} stroke={sb.grid} strokeDasharray="3 3" strokeWidth={1} />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3, fill: lineColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
