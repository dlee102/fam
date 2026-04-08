"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#0d9488", "#0ea5e9", "#7c3aed", "#ea580c", "#db2777"];

type CurveKind = "five_min_close";

interface SeriesPayload {
  ticker: string;
  curve: CurveKind;
  t0_kst: string;
  published_at: string | null;
  anchor_date: string;
  anchor_price: number;
  anchor_label: string;
  points: { label: string; date: string; bar_datetime: string; cum_ret_pct: number }[];
}

interface ApiResponse {
  series: SeriesPayload[];
}

function seriesKey(s: SeriesPayload): string {
  return `${s.ticker}__${s.curve}`;
}

function mergeRows(series: SeriesPayload[]): Record<string, string | number | null>[] {
  if (series.length === 0) return [];
  const dtSet = new Set<string>();
  for (const s of series) {
    for (const p of s.points) dtSet.add(p.bar_datetime);
  }
  const sorted = [...dtSet].sort();

  const labelByDt = new Map<string, string>();
  for (const s of series) {
    for (const p of s.points) {
      if (!labelByDt.has(p.bar_datetime)) labelByDt.set(p.bar_datetime, p.label);
    }
  }

  const valueMaps = series.map((s) => {
    const m = new Map<string, number>();
    for (const p of s.points) m.set(p.bar_datetime, p.cum_ret_pct);
    return { key: seriesKey(s), map: m };
  });

  return sorted.map((dt) => {
    const row: Record<string, string | number | null> = {
      label: labelByDt.get(dt) ?? dt,
      bar_datetime: dt,
    };
    for (const { key, map } of valueMaps) {
      const v = map.get(dt);
      row[key] = v !== undefined ? v : null;
    }
    return row;
  });
}

function legendLabel(s: SeriesPayload, tickerNames?: Record<string, string>): string {
  const nm = tickerNames?.[s.ticker];
  return nm ? `${s.ticker} (${nm})` : s.ticker;
}

export function PostPublishCumReturnChart({
  articleId,
  tickers,
  tickerNames,
  embedded = false,
}: {
  articleId: string;
  tickers: string[];
  tickerNames?: Record<string, string>;
  embedded?: boolean;
}) {
  const valid = useMemo(
    () => tickers.filter((t) => /^\d{6}$/.test(t)),
    [tickers]
  );
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "empty">("idle");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!articleId || valid.length === 0) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    const q = new URLSearchParams({ article_id: articleId, tickers: valid.join(",") });
    fetch(`/api/article/post-publish-curve?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ApiResponse | null) => {
        if (!d?.series?.length) {
          setData(null);
          setStatus("empty");
          return;
        }
        setData(d);
        setStatus("ok");
      })
      .catch(() => {
        setData(null);
        setStatus("empty");
      });
  }, [articleId, valid.join(",")]);

  const chartRows = useMemo(() => (data ? mergeRows(data.series) : []), [data]);
  const seriesList = data?.series ?? [];
  const uniqueTickers = useMemo(
    () => [...new Set(seriesList.map((s) => s.ticker))],
    [seriesList]
  );

  if (valid.length === 0) return null;

  const wrapClass = ["post-publish-chart", embedded ? "post-publish-chart--embedded" : ""]
    .filter(Boolean)
    .join(" ");

  if (status === "loading") {
    return (
      <section className={wrapClass} aria-busy="true">
        <h3 className="post-publish-chart__title">발행 후 누적 수익률 (5분봉 · T0~T+2)</h3>
        <p className="post-publish-chart__desc muted-text">불러오는 중…</p>
      </section>
    );
  }

  if (status === "empty" || !data?.series.length) {
    return (
      <section className={wrapClass}>
        <h3 className="post-publish-chart__title">발행 후 누적 수익률 (5분봉 · T0~T+2)</h3>
        <p className="post-publish-chart__desc muted-text">
          5분봉(또는 EOD 캘린더) 데이터가 없어 곡선을 표시할 수 없습니다.
        </p>
      </section>
    );
  }

  const plotH = embedded ? 220 : 260;

  return (
    <section className={wrapClass} aria-labelledby="post-publish-chart-heading">
      <h3 id="post-publish-chart-heading" className="post-publish-chart__title">
        발행 후 누적 수익률 (5분봉 · T0~T+2)
      </h3>
      <div
        className="post-publish-chart__plot"
        style={{ width: "100%", height: plotH, minHeight: plotH, minWidth: 0 }}
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" debounce={32}>
            <LineChart data={chartRows} margin={{ top: 8, right: 4, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={{ stroke: "var(--color-border-subtle)" }}
                interval="preserveStartEnd"
                minTickGap={28}
                angle={-35}
                textAnchor="end"
                height={52}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                axisLine={{ stroke: "var(--color-border-subtle)" }}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number | undefined) => [
                  value !== undefined && Number.isFinite(value) ? `${value.toFixed(2)}%` : "—",
                  "",
                ]}
                labelFormatter={(label) => String(label)}
              />
              {seriesList.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
              {seriesList.map((s) => {
                const k = seriesKey(s);
                const ti = uniqueTickers.indexOf(s.ticker);
                const stroke = COLORS[(ti >= 0 ? ti : 0) % COLORS.length];
                return (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={legendLabel(s, tickerNames)}
                    stroke={stroke}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: plotH }} aria-hidden />
        )}
      </div>
    </section>
  );
}
