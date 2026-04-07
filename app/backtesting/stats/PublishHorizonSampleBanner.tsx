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
  const hasPipelineList =
    sourceCounts.manifestBothOk != null ||
    summary.pairs_passed_t0_t1_calendar != null ||
    summary.pairs_with_at_least_one_observation != null;

  return (
    <section
      style={{
        ...backtestingPanelCard,
        fontSize: "0.8125rem",
        lineHeight: 1.55,
        color: "var(--color-text-muted)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: "0.5rem",
          fontSize: "0.875rem",
        }}
      >
        데이터·표본 요약
      </div>

      {sourceCounts.articleTickerRecords != null ? (
        <p
          style={{
            margin: "0 0 0.6rem",
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
          }}
        >
          총{" "}
          <span style={{ color: "var(--color-accent)" }}>
            {sourceCounts.articleTickerRecords.toLocaleString("ko-KR")}
          </span>
          건 — 기사×종목 원천 레코드
        </p>
      ) : (
        <p style={{ margin: "0 0 0.6rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          원천 레코드 수를 읽지 못했습니다.{" "}
          <code style={{ fontSize: "0.72rem" }}>data/somedaynews_article_tickers.json</code> 경로를 확인하세요.
        </p>
      )}

      {summary.unit_note ? <p style={{ marginBottom: "0.65rem" }}>{summary.unit_note}</p> : null}

      {hasPipelineList ? (
        <ul style={{ margin: "0 0 0.85rem", paddingLeft: "1.15rem" }}>
          {sourceCounts.manifestBothOk != null ? (
            <li>
              가격 데이터 확보(일봉·5분봉 모두 OK, 매니페스트):{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {sourceCounts.manifestBothOk.toLocaleString("ko-KR")}건
              </strong>
              {sourceCounts.manifestRows != null ? (
                <span style={{ color: "var(--color-text-faint)" }}>
                  {" "}
                  / 전체 매니페스트 행 {sourceCounts.manifestRows.toLocaleString("ko-KR")}건
                </span>
              ) : null}
            </li>
          ) : null}
          {summary.pairs_passed_t0_t1_calendar != null ? (
            <li>
              분석 후보(T0·T+1 거래일 확정, 스크립트 집계):{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {summary.pairs_passed_t0_t1_calendar.toLocaleString("ko-KR")}건
              </strong>
            </li>
          ) : null}
          {summary.pairs_with_at_least_one_observation != null ? (
            <li>
              그중 수익률이 1회 이상 집계된 건:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {summary.pairs_with_at_least_one_observation.toLocaleString("ko-KR")}건
              </strong>
            </li>
          ) : null}
        </ul>
      ) : null}

      {summary.pairs_passed_t0_t1_calendar == null &&
        summary.pairs_with_at_least_one_observation == null &&
        sourceCounts.articleTickerRecords != null && (
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.72rem", color: "var(--color-text-faint)" }}>
            T0·T+1 후보 건수는{" "}
            <code style={{ fontSize: "0.68rem" }}>python3 scripts/entry_hold_analysis.py</code>로 JSON을 다시
            만들면 함께 기록됩니다. 아래 표의 n은 차트에 들어간 표본 규모입니다.
          </p>
        )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.78rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <th style={th}>진입 시나리오</th>
              <th style={th}>1거래일 보유 시 n</th>
              <th style={th}>최장 보유(거래일)</th>
              <th style={th}>최장 구간 n</th>
              <th style={th}>구간별 n 최솟값</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((k) => {
              const r = by[k];
              return (
                <tr key={k} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{r.label}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-faint)" }}>
                      시나리오 {k}
                    </div>
                  </td>
                  <td style={td}>{r.n_at_1_trading_day.toLocaleString("ko-KR")}</td>
                  <td style={td}>{r.longest_horizon_trading_days}일</td>
                  <td style={td}>{r.n_at_longest_horizon.toLocaleString("ko-KR")}</td>
                  <td style={td}>{r.min_n_any_horizon.toLocaleString("ko-KR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "var(--color-text-faint)" }}>
        각 거래일 N마다 평균 수익률·승률은 해당 N에서 청산 가격을 쓸 수 있는 표본만으로 단순 평균합니다. N이
        커질수록 일부 종목은 데이터 창 밖이라 n이 줄어듭니다.
      </p>
    </section>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  padding: "0.35rem 0.45rem",
  color: "var(--color-text-muted)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "0.35rem 0.45rem",
  verticalAlign: "top",
  color: "var(--color-text)",
};
