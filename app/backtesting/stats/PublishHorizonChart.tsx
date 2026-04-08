"use client";

import { useMemo, useState } from "react";
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
import { BacktestingStatCard } from "../components/BacktestingStatCard";
import { backtestingPanelCard } from "../lib/ui-styles";
import type { BacktestingSourceCounts } from "../lib/backtesting-source-counts.types";
import {
  resolveSampleSummary,
  type HorizonEntrySeries,
  type PublishHorizonFile,
} from "../lib/publish-horizon.types";
import {
  bestPointByReturn,
  buildHorizonChartRows,
  type HorizonChartRow,
  HORIZON_ENTRY_COLORS,
  HORIZON_ENTRY_ORDER,
  horizonEntryLegendName,
  horizonEntryTitle,
} from "./horizon-chart-data";
import { GainLossDecompPanel } from "./GainLossDecompPanel";
import { PublishHorizonSampleBanner } from "./PublishHorizonSampleBanner";
import { TickerAttributionPanel } from "./TickerAttributionPanel";

type Props = { data: PublishHorizonFile; sourceCounts: BacktestingSourceCounts };

export function PublishHorizonChart({ data, sourceCounts }: Props) {
  const sampleSummary = useMemo(() => resolveSampleSummary(data), [data]);
  const entries = data.entries ?? {};
  const available = HORIZON_ENTRY_ORDER.filter((k) => k in entries);
  const [visible, setVisible] = useState<Set<string>>(new Set(["A", "C", "F"]));

  const toggle = (k: string) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        if (next.size === 1) return prev;
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });

  const chartData = buildHorizonChartRows(entries, visible);

  const aPoints = entries["A"]?.points ?? [];
  const cPoints = entries["C"]?.points ?? [];
  const fPoints = entries["F"]?.points ?? [];
  const bestA = bestPointByReturn(aPoints);
  const bestC = bestPointByReturn(cPoints);
  const bestF = bestPointByReturn(fPoints);

  const insightLine = useMemo(() => {
    const parts: string[] = [];
    if (bestA) {
      parts.push(
        `A는 ${bestA.trading_day}거래일에서 평균 +${bestA.avg_return_pct.toFixed(2)}% (n=${bestA.count})`
      );
    }
    if (bestC) {
      parts.push(
        `C는 ${bestC.trading_day}거래일에서 평균 +${bestC.avg_return_pct.toFixed(2)}% (n=${bestC.count})`
      );
    }
    if (bestF) {
      parts.push(
        `F(공개 직후 체결)는 ${bestF.trading_day}거래일에서 평균 +${bestF.avg_return_pct.toFixed(2)}% (n=${bestF.count})`
      );
    }
    return parts.length ? parts.join(" · ") : null;
  }, [bestA, bestC, bestF]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PublishHorizonSampleBanner summary={sampleSummary} sourceCounts={sourceCounts} />

      <section
        style={{
          ...backtestingPanelCard,
          background: "linear-gradient(145deg, var(--color-surface), color-mix(in srgb, var(--color-accent) 3%, var(--color-surface)))",
          border: "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border-subtle))",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.75rem", color: "var(--color-text)" }}>
          💡 데이터 분석 핵심 인사이트
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", fontSize: "0.8125rem", lineHeight: 1.6, color: "var(--color-text-muted)" }}>
          <div>
            • <strong style={{ color: "var(--color-text)" }}>진입 타이밍:</strong>{" "}
            <strong style={{ color: "var(--color-text)" }}>F</strong>는 API{" "}
            <code style={{ fontSize: "0.78em" }}>published_at</code> 직후 첫 장중 5분봉 종가(매매 가능 시점에 가장 가까운 봉) 기준입니다. A(당일 장종)·C(익일 장종)와 겹쳐 비교해 보세요.
          </div>
          <div>
            • <strong style={{ color: "var(--color-text)" }}>보유 효과:</strong> 단기(1~5일)보다는 중기(15일 내외) 보유 시 평균 수익률이 크게 개선되는 모습입니다. 특히 시나리오 A는 12거래일을 기점으로 수익률 곡선이 가파르게 상승합니다.
          </div>
          <div>
            • <strong style={{ color: "var(--color-text)" }}>승률 vs 수익:</strong> 평균 승률은 45~48% 수준으로 절반을 약간 하회합니다. 이는 잦은 수익보다는, 발생 시의 익절 폭이 손절 폭보다 커서 전체 수익을 견인하는 '손익비' 중심의 구조임을 시사합니다.
          </div>
        </div>
      </section>

      {insightLine ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            lineHeight: 1.55,
            color: "var(--color-text-muted)",
            padding: "0.65rem 0.85rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-subtle)",
            background: "color-mix(in srgb, var(--color-text) 4%, var(--color-surface))",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>요약 · </span>
          {insightLine}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.65rem",
        }}
      >
        {bestA && (
          <BacktestingStatCard
            label={horizonEntryTitle("A", entries.A?.label, "최고 평균 수익 구간")}
            value={`+${bestA.avg_return_pct.toFixed(3)}%`}
            sub={`${bestA.trading_day}거래일 / n=${bestA.count}`}
            color="var(--color-accent)"
          />
        )}
        {bestC && (
          <BacktestingStatCard
            label={horizonEntryTitle("C", entries.C?.label, "최고 평균 수익 구간")}
            value={`+${bestC.avg_return_pct.toFixed(3)}%`}
            sub={`${bestC.trading_day}거래일 / n=${bestC.count}`}
            color={HORIZON_ENTRY_COLORS.C}
          />
        )}
        {bestF && entries.F && (
          <BacktestingStatCard
            label={horizonEntryTitle("F", entries.F?.label, "최고 평균 수익 구간")}
            value={`+${bestF.avg_return_pct.toFixed(3)}%`}
            sub={`${bestF.trading_day}거래일 / n=${bestF.count}`}
            color={HORIZON_ENTRY_COLORS.F}
          />
        )}
      </div>

      <section style={backtestingPanelCard}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem 1rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)" }}>
            평균 수익률·승률 (거래일 N일 보유)
          </span>
          {data.generated_at && (
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
              집계: {data.generated_at.slice(0, 10)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.1rem" }}>
          {available.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              style={{
                padding: "0.4rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${HORIZON_ENTRY_COLORS[k] ?? "#888"}`,
                background: visible.has(k) ? `${HORIZON_ENTRY_COLORS[k] ?? "#888"}18` : "transparent",
                color: visible.has(k) ? (HORIZON_ENTRY_COLORS[k] ?? "#888") : "var(--color-text-faint)",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.12s",
                textAlign: "left",
                maxWidth: "min(100%, 220px)",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: visible.has(k) ? "var(--color-text)" : "var(--color-text-muted)",
                  fontWeight: 600,
                  lineHeight: 1.35,
                }}
              >
                {entries[k]?.label ?? k}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "0.15rem",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  opacity: 0.85,
                }}
              >
                시나리오 {k}
              </span>
            </button>
          ))}
        </div>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                label={{
                  value: "보유 거래일 (N)",
                  position: "insideBottom",
                  offset: -8,
                  style: { fill: "var(--color-text-muted)", fontSize: 11 },
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                tickFormatter={(v) => `${v}%`}
                width={50}
              />
              <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeDasharray="4 3" />
              <Tooltip
                content={(tooltipProps) => (
                  <HorizonReturnTooltip
                    active={tooltipProps.active}
                    payload={tooltipProps.payload}
                    label={tooltipProps.label}
                    chartData={chartData}
                    entries={entries}
                  />
                )}
              />
              {available
                .filter((k) => visible.has(k))
                .map((k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={k}
                    stroke={HORIZON_ENTRY_COLORS[k]}
                    strokeWidth={2}
                    dot={{ r: 2, fill: HORIZON_ENTRY_COLORS[k] }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {data.definition ? (
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.72rem",
              color: "var(--color-text-faint)",
              lineHeight: 1.55,
            }}
          >
            {data.definition}
          </p>
        ) : null}
      </section>

      <details
        style={{
          ...backtestingPanelCard,
          cursor: "pointer",
        }}
      >
        <summary
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-text)",
            listStyle: "none",
          }}
        >
          세부 분석 (손익 분해 · 종목 귀속)
        </summary>
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <GainLossDecompPanel entries={entries} available={available} />
          <TickerAttributionPanel
            tickerAttribution={data.ticker_attribution}
            entries={entries}
            available={available}
          />
        </div>
      </details>
    </div>
  );
}

type HorizonTooltipPayloadItem = {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
};

function HorizonReturnTooltip(props: {
  active?: boolean;
  payload?: readonly HorizonTooltipPayloadItem[];
  label?: string | number;
  chartData: HorizonChartRow[];
  entries: Record<string, HorizonEntrySeries>;
}) {
  const { active, payload, label, chartData, entries } = props;
  if (!active || !payload?.length) return null;
  const day = Number(label);
  const row = chartData.find((r) => r.day === day);
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "8px",
        fontSize: "12px",
        padding: "0.5rem 0.65rem",
        minWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.35rem", color: "var(--color-text)" }}>
        {day}거래일
      </div>
      {payload.map((p: HorizonTooltipPayloadItem) => {
        const code = String(p.name ?? "");
        const leg = horizonEntryLegendName(code, entries[code]?.label);
        const v = Number(p.value ?? 0);
        const wrKey = `${code}_wr` as keyof HorizonChartRow;
        const nKey = `${code}_n` as keyof HorizonChartRow;
        const wr = row ? (row[wrKey] as number | null | undefined) : null;
        const n = row ? (row[nKey] as number | null | undefined) : null;
        return (
          <div key={code} style={{ marginTop: "0.28rem", color: "var(--color-text-muted)" }}>
            <span style={{ color: p.color ?? "var(--color-text)" }}>{leg}</span>
            {": "}
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
              {v >= 0 ? "+" : ""}
              {v.toFixed(3)}%
            </span>
            {wr != null && wr !== undefined ? ` · 승률 ${wr}%` : ""}
            {n != null && n !== undefined ? ` · n=${n}` : ""}
          </div>
        );
      })}
    </div>
  );
}
