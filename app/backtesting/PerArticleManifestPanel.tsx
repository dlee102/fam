"use client";

import type { CSSProperties } from "react";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { sb, qLabel } from "@/app/article/[newsId]/sidebar-tokens";
import type { PerArticleManifestRow, PerArticleManifestSummary } from "./per-article-manifest";
import { ArticleEodChart } from "./manifest/ArticleEodChart";

function fmtShortIso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OkBadge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: "2.25rem",
        textAlign: "center",
        fontSize: "0.75rem",
        fontWeight: 600,
        padding: "0.15rem 0.4rem",
        borderRadius: "var(--radius-sm)",
        color: ok ? sb.up : sb.down,
        border: `1px solid ${ok ? sb.up : sb.down}`,
        backgroundColor: ok ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.06)",
      }}
    >
      {ok ? "OK" : "—"}
    </span>
  );
}

export function PerArticleManifestPanel({
  rows,
  summary,
  relativePath,
}: {
  rows: PerArticleManifestRow[];
  summary: PerArticleManifestSummary;
  relativePath: string;
}) {
  const [q, setQ] = useState("");
  const [onlyIssue, setOnlyIssue] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function rowKey(r: PerArticleManifestRow) {
    return `${r.article_idx}-${r.article_id}-${r.ticker}`;
  }

  function toggleRow(r: PerArticleManifestRow) {
    const k = rowKey(r);
    setExpandedKey((prev) => (prev === k ? null : k));
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyIssue && r.eod_ok && r.intraday_ok) return false;
      if (!t) return true;
      return (
        r.ticker.toLowerCase().includes(t) ||
        r.article_id.toLowerCase().includes(t) ||
        r.t0_kst.toLowerCase().includes(t)
      );
    });
  }, [rows, q, onlyIssue]);

  if (summary.total === 0) {
    return (
      <section
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--quant-border)",
          backgroundColor: "var(--quant-surface)",
          color: sb.muted,
          fontSize: "0.875rem",
          lineHeight: 1.55,
        }}
      >
        매니페스트가 없습니다. 경로를 확인하세요: <code style={{ fontSize: "0.75rem" }}>{relativePath}</code>
      </section>
    );
  }

  return (
    <div style={{ fontVariantNumeric: "tabular-nums" }}>
      <div style={{ ...qLabel, marginBottom: "0.35rem", fontSize: "0.8125rem" }}>
        Per-article EODHD 윈도 · 매니페스트
      </div>
      <p
        style={{
          fontSize: "0.9375rem",
          color: sb.muted,
          lineHeight: 1.6,
          marginBottom: "1rem",
        }}
      >
        기사·종목 단위로 다운로드한 일봉·5분봉 캐시 목록입니다.{" "}
        <strong style={{ color: sb.text }}>article_idx</strong>는 매니페스트 내 순서이고,{" "}
        <strong style={{ color: sb.text }}>window_from~window_to</strong>는 해당 건에 쓰인 EODHD 요청 구간입니다.
        집계·차트는 이 매니페스트를 입력으로 하는 스크립트를 다시 돌린 뒤 별도 산출물을 붙이면 됩니다.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
          gap: "0.65rem",
          marginBottom: "1rem",
        }}
      >
        <Kpi label="총 건수" value={`${summary.total}`} />
        <Kpi label="일봉 OK" value={`${summary.eodOk}`} accent={summary.eodOk === summary.total ? "ok" : "warn"} />
        <Kpi
          label="5분봉 OK"
          value={`${summary.intradayOk}`}
          accent={summary.intradayOk === summary.total ? "ok" : "warn"}
        />
        <Kpi label="둘 다 OK" value={`${summary.bothOk}`} />
        <Kpi label="고유 종목" value={`${summary.distinctTickers}`} />
        <Kpi label="파일 갱신(로컬)" value={fmtShortIso(summary.fileMtimeIso)} small />
      </div>

      <div
        style={{
          marginBottom: "1rem",
          padding: "0.85rem 1rem",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${sb.border}`,
          backgroundColor: "var(--quant-surface)",
          fontSize: "0.8125rem",
          color: sb.muted,
          lineHeight: 1.55,
        }}
      >
        <div style={{ ...qLabel, marginBottom: "0.45rem", fontSize: "0.75rem" }}>게시 시각 범위 (published_at)</div>
        <span style={{ color: sb.text }}>{fmtShortIso(summary.publishedMin)}</span>
        {" ~ "}
        <span style={{ color: sb.text }}>{fmtShortIso(summary.publishedMax)}</span>
        <div style={{ marginTop: "0.65rem", ...qLabel, fontSize: "0.75rem" }}>기사 많은 종목 (상위 15)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 0.75rem", marginTop: "0.35rem" }}>
          {summary.topTickers.map(({ ticker, count }) => (
            <span key={ticker}>
              <strong style={{ color: sb.text }}>{ticker}</strong>{" "}
              <span style={{ color: sb.faint }}>({count})</span>
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.65rem",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <input
          type="search"
          placeholder="종목·기사 ID·t0_kst 검색…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: "1 1 220px",
            minWidth: "200px",
            padding: "0.45rem 0.65rem",
            fontSize: "0.875rem",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${sb.border}`,
            backgroundColor: "var(--color-surface)",
            color: sb.text,
          }}
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8125rem",
            color: sb.muted,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={onlyIssue}
            onChange={(e) => setOnlyIssue(e.target.checked)}
            style={{ accentColor: sb.accent, width: "1rem", height: "1rem" }}
          />
          일봉/분봉 누락만
        </label>
        <span style={{ fontSize: "0.75rem", color: sb.faint }}>
          표시 {filtered.length} / {rows.length}
        </span>
      </div>

      <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: `1px solid ${sb.border}` }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
            color: sb.text,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "var(--quant-surface)", borderBottom: `1px solid ${sb.grid}` }}>
              <th style={th}>idx</th>
              <th style={th}>ticker</th>
              <th style={th}>기사</th>
              <th style={th}>published</th>
              <th style={th}>t0</th>
              <th style={th}>window</th>
              <th style={th}>EOD</th>
              <th style={th}>5m</th>
              <th style={th}>rows</th>
              <th style={{ ...th, width: "2rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const k = rowKey(r);
              const isExpanded = expandedKey === k;
              return (
                <Fragment key={k}>
                  <tr
                    onClick={() => toggleRow(r)}
                    style={{
                      borderBottom: isExpanded ? "none" : `1px solid ${sb.grid}`,
                      cursor: "pointer",
                      backgroundColor: isExpanded ? "var(--quant-surface)" : "transparent",
                      transition: "background 0.1s",
                    }}
                    title="클릭하면 ±20일 차트를 펼칩니다"
                  >
                    <td style={td}>{r.article_idx}</td>
                    <td style={td}>{r.ticker}</td>
                    <td style={td}>
                      <Link
                        href={`/article/${encodeURIComponent(r.article_id)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: sb.accent, textDecoration: "none" }}
                      >
                        {r.article_id.length > 14 ? `${r.article_id.slice(0, 14)}…` : r.article_id}
                      </Link>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtShortIso(r.published_at)}</td>
                    <td style={td}>{r.t0_kst}</td>
                    <td style={{ ...td, fontSize: "0.75rem", color: sb.muted }}>
                      {r.window_from}~{r.window_to}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <OkBadge ok={r.eod_ok} />
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <OkBadge ok={r.intraday_ok} />
                    </td>
                    <td style={{ ...td, fontSize: "0.75rem", color: sb.faint }}>
                      {r.eod_rows ?? "—"} / {r.intraday_rows ?? "—"}
                    </td>
                    <td style={{ ...td, fontSize: "0.85rem", color: sb.faint, textAlign: "center" }}>
                      {isExpanded ? "▲" : "▼"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: `1px solid ${sb.grid}` }}>
                      <td colSpan={10} style={{ padding: 0 }}>
                        <ArticleEodChart row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: "0.75rem", color: sb.faint, marginTop: "0.85rem", lineHeight: 1.55 }}>
        데이터 원본: <code style={{ fontSize: "0.7rem" }}>{relativePath}</code>
        {" · "}
        후속 분석 예:{" "}
        <code style={{ fontSize: "0.7rem" }}>python3 scripts/analyze_10m_return_path.py</code> (입력 매니페스트 경로는 스크립트 설정
        확인)
      </p>
    </div>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.55rem",
  color: sb.muted,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "0.45rem 0.55rem",
  verticalAlign: "middle",
};

function Kpi({
  label,
  value,
  small,
  accent,
}: {
  label: string;
  value: string;
  small?: boolean;
  accent?: "ok" | "warn";
}) {
  const c = accent === "ok" ? sb.up : accent === "warn" ? sb.down : sb.text;
  return (
    <div
      style={{
        padding: "0.65rem 0.75rem",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${sb.border}`,
        backgroundColor: "var(--quant-surface)",
      }}
    >
      <div style={{ fontSize: "0.75rem", color: sb.faint, marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: small ? "0.8125rem" : "1.0625rem", fontWeight: 700, color: c }}>{value}</div>
    </div>
  );
}
