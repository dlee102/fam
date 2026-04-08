"use client";

import type { CSSProperties } from "react";
import type { BacktestingSourceCounts } from "../lib/backtesting-source-counts.types";
import type { HorizonSampleSummary } from "../lib/publish-horizon.types";
import { backtestingPanelCard } from "../lib/ui-styles";
import { HORIZON_ENTRY_ORDER } from "./horizon-chart-data";

type Props = { summary: HorizonSampleSummary; sourceCounts: BacktestingSourceCounts };

export function PublishHorizonSampleBanner({ summary, sourceCounts }: Props) {
  const by = summary.by_entry ?? {};
  const ordered = HORIZON_ENTRY_ORDER.filter((k) => by[k]);

  const pipelineHint =
    summary.pairs_passed_t0_t1_calendar != null &&
    summary.pairs_with_at_least_one_observation != null
      ? `후보 ${summary.pairs_passed_t0_t1_calendar.toLocaleString("ko-KR")}건 → 수익 집계 ${summary.pairs_with_at_least_one_observation.toLocaleString("ko-KR")}건`
      : null;

  return (
    <section
      style={{
        ...backtestingPanelCard,
        fontSize: "0.8125rem",
        lineHeight: 1.5,
        color: "var(--color-text-muted)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: "0.45rem",
          fontSize: "0.8125rem",
        }}
      >
        표본
      </div>

      {sourceCounts.articleTickerRecords != null ? (
        <p style={{ margin: "0 0 0.5rem", color: "var(--color-text)" }}>
          기사×종목{" "}
          <strong style={{ color: "var(--color-accent)" }}>
            {sourceCounts.articleTickerRecords.toLocaleString("ko-KR")}
          </strong>
          건
          {pipelineHint ? (
            <span style={{ color: "var(--color-text-muted)" }}> · {pipelineHint}</span>
          ) : null}
        </p>
      ) : (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem" }}>
          원천 건수를 읽지 못했습니다.{" "}
          <code style={{ fontSize: "0.7rem" }}>data/somedaynews_article_tickers.json</code>
        </p>
      )}

      {summary.unit_note ? (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem" }}>{summary.unit_note}</p>
      ) : null}

      {ordered.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.75rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                <th style={th}>시나리오</th>
                <th style={th}>1일 n</th>
                <th style={th}>구간별 n 최소</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((k) => {
                const r = by[k];
                return (
                  <tr key={k} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td style={td}>
                      <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{k}</span>
                      <span style={{ color: "var(--color-text-faint)", marginLeft: "0.35rem" }}>
                        {r.label}
                      </span>
                    </td>
                    <td style={td}>{r.n_at_1_trading_day.toLocaleString("ko-KR")}</td>
                    <td style={td}>{r.min_n_any_horizon.toLocaleString("ko-KR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p style={{ margin: "0.55rem 0 0", fontSize: "0.7rem", color: "var(--color-text-faint)" }}>
        거래일 N마다 청산 가능한 표본만 평균합니다. N이 길어지면 n이 줄 수 있습니다.
      </p>
    </section>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  padding: "0.3rem 0.4rem",
  color: "var(--color-text-muted)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "0.3rem 0.4rem",
  verticalAlign: "top",
  color: "var(--color-text)",
};
