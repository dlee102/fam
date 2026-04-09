"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#0d9488", "#0ea5e9", "#7c3aed", "#ea580c", "#db2777"];

/** 홀수 일(T+1)에 깔리는 배경색 — 테마에서 분기 */
const DAY_BAND_FILL = "rgba(128,128,128,0.06)";

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

type MergedRow = Record<string, string | number | null>;

interface DayRange {
  dayIdx: number;
  x1: string;
  x2: string;
  tag: string; // "T-3" | "T-2" | "T-1" | "T0" | "T+1" | ...
}

function seriesKey(s: SeriesPayload): string {
  return `${s.ticker}__${s.curve}`;
}

function mergeRows(series: SeriesPayload[]): MergedRow[] {
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
    const row: MergedRow = {
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

/** label 의 day prefix ("0", "1", "2") 추출 */
function dayPrefix(label: string): string {
  return label.split("·")[0] ?? "";
}

/** T0 / T+1 / T+2 범위와 각 날짜의 첫 라벨을 반환 */
function getDayRanges(rows: MergedRow[]): DayRange[] {
  if (!rows.length) return [];
  const ranges: DayRange[] = [];
  let curDay = "";
  let x1 = "";

  for (let i = 0; i < rows.length; i++) {
    const lbl = String(rows[i].label ?? "");
    const dp = dayPrefix(lbl);
    if (dp !== curDay) {
      if (curDay !== "" && x1) {
        const prev = String(rows[i - 1].label ?? "");
        const n = parseInt(curDay);
        ranges.push({ dayIdx: n, x1, x2: prev, tag: dayTag(n) });
      }
      curDay = dp;
      x1 = lbl;
    }
  }
  if (curDay && x1) {
    const last = String(rows[rows.length - 1].label ?? "");
    const n = parseInt(curDay);
    ranges.push({ dayIdx: n, x1, x2: last, tag: dayTag(n) });
  }
  return ranges;
}

function dayTag(n: number): string {
  if (n === 0) return "T0";
  if (n > 0) return `T+${n}`;
  return `T${n}`; // T-1, T-2, T-3
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
  const dayRanges = useMemo(() => getDayRanges(chartRows), [chartRows]);
  const seriesList = data?.series ?? [];
  const uniqueTickers = useMemo(
    () => [...new Set(seriesList.map((s) => s.ticker))],
    [seriesList]
  );

  /** label → KST 날짜 "YYYY-MM-DD" */
  const labelToDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of seriesList) {
      for (const p of s.points) {
        if (!m.has(p.label)) m.set(p.label, p.date);
      }
    }
    return m;
  }, [seriesList]);

  /** 각 거래일 중간 봉의 label — X축 틱으로 사용해 날짜 레이블을 중앙 정렬 */
  const dayTicks = useMemo(() => {
    if (!chartRows.length) return [];
    return dayRanges.map((r) => {
      const i1 = chartRows.findIndex((row) => row.label === r.x1);
      const i2 = chartRows.findIndex((row) => row.label === r.x2);
      const mid = i1 >= 0 && i2 >= i1 ? Math.floor((i1 + i2) / 2) : Math.max(0, i1);
      return String(chartRows[mid]?.label ?? r.x1);
    });
  }, [dayRanges, chartRows]);

  if (valid.length === 0) return null;

  const wrapClass = ["post-publish-chart", embedded ? "post-publish-chart--embedded" : ""]
    .filter(Boolean)
    .join(" ");

  if (status === "loading") {
    return (
      <section className={wrapClass} aria-busy="true">
        <h3 className="post-publish-chart__title">발행 전후 누적 수익률</h3>
        <p className="post-publish-chart__desc muted-text">불러오는 중…</p>
      </section>
    );
  }

  if (status === "empty" || !data?.series.length) {
    return (
      <section className={wrapClass}>
        <h3 className="post-publish-chart__title">발행 전후 누적 수익률</h3>
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
        발행 전후 누적 수익률
      </h3>
      <div
        className="post-publish-chart__plot"
        style={{ width: "100%", height: plotH, minHeight: plotH, minWidth: 0 }}
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" debounce={32}>
            <LineChart data={chartRows} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />

              {/* 거래일별 배경 밴드 — 홀수 일만 채색 */}
              {dayRanges.map((r) =>
                r.dayIdx % 2 !== 0 ? (
                  <ReferenceArea
                    key={`band-${r.tag}`}
                    x1={r.x1}
                    x2={r.x2}
                    fill={DAY_BAND_FILL}
                    stroke="none"
                    ifOverflow="visible"
                  />
                ) : null
              )}

              {/* 거래일별 경계 수직선 — 레이블 없음 (날짜는 X축, T0는 아래서 별도 강조) */}
              {dayRanges
                .filter((r) => r.dayIdx !== 0)
                .map((r) => (
                  <ReferenceLine
                    key={`div-${r.tag}`}
                    x={r.x1}
                    stroke="var(--color-border-subtle)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                ))}

              {/* T0 발행일 마커 — 더 굵고 색상 강조 */}
              {dayRanges.find((r) => r.dayIdx === 0) ? (
                <ReferenceLine
                  x={dayRanges.find((r) => r.dayIdx === 0)!.x1}
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{
                    value: "발행",
                    position: "insideTopLeft",
                    fontSize: 9,
                    fontWeight: 700,
                    fill: "var(--color-accent)",
                    dy: 2,
                    dx: 3,
                  }}
                />
              ) : null}

              <XAxis
                dataKey="label"
                ticks={dayTicks}
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                axisLine={{ stroke: "var(--color-border-subtle)" }}
                height={28}
                tickFormatter={(lbl: string) => {
                  const date = labelToDate.get(lbl);
                  if (!date) return "";
                  const parts = date.split("-");
                  return `${parseInt(parts[1] ?? "0")}/${parseInt(parts[2] ?? "0")}`;
                }}
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
                labelFormatter={(lbl) => {
                  const s = typeof lbl === "string" ? lbl : String(lbl ?? "");
                  // "0·09:05" → "3/24 09:05 (T0)"
                  const parts = s.split("·");
                  const time = parts[1] ?? "";
                  const n = parseInt(parts[0] ?? "");
                  const tag = dayTag(n);
                  const date = labelToDate.get(s);
                  if (date) {
                    const dp = date.split("-");
                    const md = `${parseInt(dp[1] ?? "0")}/${parseInt(dp[2] ?? "0")}`;
                    return `${md} ${time} (${tag})`;
                  }
                  return `${tag} · ${time}`;
                }}
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
