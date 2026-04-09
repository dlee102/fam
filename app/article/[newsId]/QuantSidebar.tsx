"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { QuantInsight } from "@/lib/quant-engine";
import { sanitizeYahooDisplayName } from "@/lib/quant-fundamentals/extract-metrics";
import type { FundamentalSnapshotForModel, FundamentalScoreBreakdown } from "@/lib/quant-fundamentals/types";
import type {
  QuantOpinionLayout,
  QuantOpinionRequestPayload,
} from "@/lib/quant-opinion-shared";
import {
  buildQuantOpinionLayout,
  templateQuantOpinionKo,
} from "@/lib/quant-opinion-shared";
import {
  AiScoreOrb,
  quantStanceBarGradient,
  quantStanceBarPct,
} from "./AiScoreOrb";
import { PostPublishCumReturnChart } from "./PostPublishCumReturnChart";

function asideClass(base: string, extra?: string) {
  return [base, extra].filter(Boolean).join(" ");
}

// ── 작은 UI 유틸 ──────────────────────────────────────────────────────
function Row({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="article-quant-sidebar__row">
      <span className="article-quant-sidebar__row-key">{label}</span>
      <span className="article-quant-sidebar__row-val" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="article-quant-sidebar__divider" />;
}

function MiniBar({
  value,
  gradient,
}: {
  value: number;  // 0-100
  gradient?: string;
}) {
  return (
    <div className="article-quant-sidebar__bar-track">
      <div
        className="article-quant-sidebar__bar-fill"
        style={{
          width: `${Math.max(2, Math.min(100, value))}%`,
          background: gradient,
        }}
      />
    </div>
  );
}

// ── 스켈레톤(본문만) ────────────────────────────────────────────────────
function QuantSkeletonBody() {
  return (
    <>
      <p className="article-quant-sidebar__heading">퀀트 인사이트</p>
      {[80, 60, 50, 70, 55].map((w, i) => (
        <div
          key={i}
          style={{
            height: "0.75rem",
            width: `${w}%`,
            background: "var(--quant-grid)",
            borderRadius: 4,
            marginBottom: "0.75rem",
            animation: "article-skeleton-pulse 1.4s ease-in-out infinite",
          }}
        />
      ))}
    </>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────
interface Props {
  articleId: string;
  ticker?: string;
  className?: string;
  /** 발행 후 누적 수익률 차트용 종목 (없으면 `ticker` 한 종목만 시도) */
  chartTickers?: string[];
  chartTickerNames?: Record<string, string>;
  /** AI 해석용 — 크롤 본문 발췌(없으면 빈 문자열) */
  articleTitle?: string;
  articleExcerpt?: string;
}

type QuantInsightApi = QuantInsight & {
  article_sentiment?: {
    label_ko: string;
    primary_type_ko?: string | null;
    catalyst_label_ko?: string | null;
  } | null;
  fundamentals_snapshot?: FundamentalSnapshotForModel | null;
  fundamental_score?: FundamentalScoreBreakdown | null;
};

function formatKrwCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}조 원`;
  if (abs >= 1e8) return `${(n / 1e8).toFixed(1)}억 원`;
  if (abs >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만 원`;
  return `${Math.round(n).toLocaleString("ko-KR")} 원`;
}

function fmtMetric(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (Math.abs(v) <= 1 && v !== 0) return `${(v * 100).toFixed(1)}%`;
  if (Math.abs(v) >= 1000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  return String(Math.round(v * 100) / 100);
}

// ── 펀더멘탈 점수 게이지 ─────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  우량: "#22c55e",
  양호: "#84cc16",
  보통: "#f59e0b",
  주의: "#f97316",
  위험: "#ef4444",
};

const AXIS_LABELS: Record<string, string> = {
  profit_direction_score: "영업이익 방향성",
  revenue_growth_score: "매출 성장",
  cash_health_score: "재무 건전성",
  margin_quality_score: "수익성 품질",
};

const AXIS_WEIGHTS: Record<string, number> = {
  profit_direction_score: 35,
  revenue_growth_score: 25,
  cash_health_score: 25,
  margin_quality_score: 15,
};

type AxisKey = keyof typeof AXIS_LABELS;

const FSCORE_AXIS_KEYS = [
  "profit_direction_score",
  "revenue_growth_score",
  "cash_health_score",
  "margin_quality_score",
] as const satisfies readonly (keyof FundamentalScoreBreakdown)[];

function FundamentalScoreCard({ fscore }: { fscore: FundamentalScoreBreakdown }) {
  const color = GRADE_COLORS[fscore.grade_label] ?? "var(--quant-muted)";

  return (
    <div className="article-quant-sidebar__fscore-card">
      {/* 헤더 — 총점 + 등급 라벨 */}
      <div className="article-quant-sidebar__fscore-header">
        <span className="article-quant-sidebar__fscore-label">펀더멘탈 점수</span>
        <span className="article-quant-sidebar__fscore-grade" style={{ color }}>
          {fscore.grade_label}
        </span>
      </div>
      {/* 총점 바 */}
      <div className="article-quant-sidebar__fscore-total-row">
        <span className="article-quant-sidebar__fscore-total-num" style={{ color }}>
          {fscore.total}
        </span>
        <span className="article-quant-sidebar__fscore-total-denom">/ 100</span>
        <div className="article-quant-sidebar__fscore-bar-wrap">
          <MiniBar
            value={fscore.total}
            gradient={`linear-gradient(90deg, ${color}90 0%, ${color} 100%)`}
          />
        </div>
      </div>
      {/* 축별 행 */}
      <div className="article-quant-sidebar__fscore-axes">
        {FSCORE_AXIS_KEYS.map((key) => {
          const val = fscore[key];
          const w = AXIS_WEIGHTS[key as AxisKey];
          return (
            <div key={key} className="article-quant-sidebar__fscore-axis-row">
              <span className="article-quant-sidebar__fscore-axis-name">
                {AXIS_LABELS[key as AxisKey]}
                <span className="article-quant-sidebar__fscore-axis-weight">({w}%)</span>
              </span>
              {val !== null ? (
                <div className="article-quant-sidebar__fscore-axis-right">
                  <span className="article-quant-sidebar__fscore-axis-val">{val}</span>
                  <div className="article-quant-sidebar__fscore-axis-bar">
                    <MiniBar value={val} />
                  </div>
                </div>
              ) : (
                <span className="article-quant-sidebar__fscore-axis-na">데이터 없음</span>
              )}
            </div>
          );
        })}
      </div>
      {fscore.axes_available < 4 ? (
        <p className="article-quant-sidebar__fscore-note">
          {fscore.axes_available}개 축 기반 산출 · 일부 지표 누락
        </p>
      ) : null}
    </div>
  );
}

function FundamentalsBlock({
  snap,
  fscore,
  krxCode,
  krxDisplayName,
  embeddedInPanel,
}: {
  snap: FundamentalSnapshotForModel;
  fscore?: FundamentalScoreBreakdown | null;
  krxCode?: string;
  krxDisplayName?: string;
  /** 상세 토글 패널 안 — 상단 구분선·여백 축소 */
  embeddedInPanel?: boolean;
}) {
  const m = snap.metrics;
  const pb = typeof m.priceToBook === "number" ? m.priceToBook : null;
  const mcap = typeof m.marketCap === "number" ? m.marketCap : null;
  const roe = fmtMetric(m.returnOnEquity);
  const de = fmtMetric(m.debtToEquity);
  const opm = fmtMetric(m.operatingMargins);
  const peTtm = typeof m.trailingPE === "number" ? m.trailingPE : null;
  const peFwd = typeof m.forwardPE === "number" ? m.forwardPE : null;
  const stmt = snap.statement_highlights ?? [];

  const safeYahooName = sanitizeYahooDisplayName(snap.company_name);
  const titleName =
    (krxDisplayName?.trim() ? krxDisplayName.trim() : null) ||
    safeYahooName ||
    (krxCode && /^\d{6}$/.test(krxCode) ? `종목 ${krxCode}` : null);

  const hasRows =
    titleName ||
    snap.sector ||
    peTtm !== null ||
    peFwd !== null ||
    pb !== null ||
    mcap !== null ||
    roe ||
    de ||
    opm ||
    stmt.length > 0;

  const fundRoot = [
    "article-quant-sidebar__fundamentals",
    embeddedInPanel ? "article-quant-sidebar__fundamentals--in-panel" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (snap.data_quality === "missing" && !hasRows) {
    return (
      <div className={fundRoot}>
        <span className="article-quant-sidebar__label">펀더멘탈</span>
        {fscore ? <FundamentalScoreCard fscore={fscore} /> : null}
        <p className="article-quant-sidebar__fundamentals-empty">
          저장된 요약이 없습니다. Yahoo 심볼 매핑·스냅샷 갱신이 필요할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={fundRoot}>
      <span className="article-quant-sidebar__label">펀더멘탈</span>
      {fscore ? <FundamentalScoreCard fscore={fscore} /> : null}
      <div className="article-quant-sidebar__fundamentals-card">
        {titleName ? (
          <p className="article-quant-sidebar__fundamentals-name">{titleName}</p>
        ) : null}
        <p className="article-quant-sidebar__fundamentals-meta">
          {krxCode && /^\d{6}$/.test(krxCode) ? `코드 ${krxCode}` : snap.ticker_key}
          {snap.yahoo_symbol ? ` · Yahoo ${snap.yahoo_symbol}` : ""}
        </p>
        {(snap.sector || snap.industry) && (
          <p className="article-quant-sidebar__fundamentals-meta">
            {[snap.sector, snap.industry].filter(Boolean).join(" · ")}
          </p>
        )}
        {mcap !== null ? (
          <Row label="시가총액(참고)" value={formatKrwCompact(mcap)} />
        ) : null}
        {peTtm !== null ? (
          <Row label="PER (TTM)" value={fmtMetric(peTtm) ?? "—"} />
        ) : null}
        {peFwd !== null ? (
          <Row label="PER (선행)" value={fmtMetric(peFwd) ?? "—"} />
        ) : null}
        {pb !== null ? <Row label="PBR(참고)" value={fmtMetric(pb) ?? "—"} /> : null}
        {roe ? <Row label="ROE(참고)" value={roe} /> : null}
        {opm ? <Row label="영업이익률(info)" value={opm} /> : null}
        {de ? <Row label="부채비율" value={de} /> : null}

        {stmt.length > 0 ? (
          <div className="article-quant-sidebar__fundamentals-statements">
            <p className="article-quant-sidebar__fundamentals-statements-kicker">
              손익계산서(야후, 연·분기 중 수집된 구간)
            </p>
            {stmt.map((h) => (
              <div key={h.period_end} className="article-quant-sidebar__fundamentals-period">
                <p className="article-quant-sidebar__fundamentals-period-date">
                  {h.period_end.replace(/-/g, ".")}
                </p>
                {h.total_revenue !== null ? (
                  <Row label="매출" value={formatKrwCompact(h.total_revenue)} />
                ) : null}
                {h.operating_income !== null ? (
                  <Row label="영업이익" value={formatKrwCompact(h.operating_income)} />
                ) : null}
                {h.net_income !== null ? (
                  <Row label="당기순이익" value={formatKrwCompact(h.net_income)} />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p className="article-quant-sidebar__fundamentals-foot">
        Yahoo Finance 기반 요약이며 시차·누락이 있을 수 있습니다. 투자 판단의 유일한 근거로 쓰이지 않습니다.
        {snap.bundle_generated_at
          ? ` · 스냅샷: ${snap.bundle_generated_at.slice(0, 10)}`
          : ""}
        {snap.data_quality === "thin" && !stmt.length ? " · 일부 지표만 수집됨" : ""}
      </p>
    </div>
  );
}

function resolveChartTickers(
  chartTickers: string[] | undefined,
  ticker: string | undefined
): string[] {
  const fromProp = chartTickers?.filter((t) => /^\d{6}$/.test(t)) ?? [];
  if (fromProp.length) return fromProp;
  if (ticker && /^\d{6}$/.test(ticker)) return [ticker];
  return [];
}

function buildOpinionPayload(
  d: QuantInsightApi,
  ctx: { title?: string; excerpt?: string }
): QuantOpinionRequestPayload {
  const sent = d.article_sentiment;
  const title = ctx.title?.trim();
  const excerpt = ctx.excerpt?.trim();
  return {
    ticker: d.ticker,
    as_of_date: d.as_of_date,
    bar_source: d.bar_source,
    grade: d.grade,
    score: { total: d.score.total },
    summary: d.summary,
    primary_signal: {
      type: d.primary_signal.type,
      label: d.primary_signal.label,
      strength: d.primary_signal.strength,
    },
    trend_filter: {
      above_ma20: d.trend_filter.above_ma20,
      momentum_direction: d.trend_filter.momentum_direction,
      contrarian_setup: d.trend_filter.contrarian_setup,
      summary: d.trend_filter.summary,
    },
    indicators: {
      atr_ratio: d.indicators.atr_ratio,
      vol_ratio20: d.indicators.vol_ratio20,
      ma5_20_spread: d.indicators.ma5_20_spread,
      momentum10d: d.indicators.momentum10d,
      bb_pct_b: d.indicators.bb_pct_b,
      rsi14: d.indicators.rsi14,
      ma20: d.indicators.ma20,
      bb_lower: d.indicators.bb_lower,
    },
    entry: {
      stop_loss_pct: d.entry.stop_loss_pct,
      timing_label: d.entry.timing_label,
    },
    ...(title ? { article_title: title } : {}),
    ...(excerpt ? { article_excerpt: excerpt } : {}),
    ...(sent?.label_ko ? { sentiment_label_ko: sent.label_ko } : {}),
    ...(sent?.primary_type_ko ? { article_primary_type_ko: sent.primary_type_ko } : {}),
    ...(sent?.catalyst_label_ko ? { catalyst_label_ko: sent.catalyst_label_ko } : {}),
  };
}

export function QuantSidebar({
  articleId,
  ticker,
  className,
  chartTickers,
  chartTickerNames,
  articleTitle,
  articleExcerpt,
}: Props) {
  const [data, setData] = useState<QuantInsightApi | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty">("loading");
  const [detailOpen, setDetailOpen] = useState(false);
  const detailPanelId = useId();
  const [aiOpinion, setAiOpinion] = useState<{
    layout: QuantOpinionLayout;
    source: string;
  } | null>(null);
  const [aiOpinionLoading, setAiOpinionLoading] = useState(false);

  const resolvedChartTickers = useMemo(
    () => resolveChartTickers(chartTickers, ticker),
    [chartTickers, ticker]
  );

  useEffect(() => {
    if (!articleId) { setStatus("empty"); return; }
    setStatus("loading");
    const params = new URLSearchParams({ article_id: articleId });
    if (ticker) params.set("ticker", ticker);

    fetch(`/api/quant/insight?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: QuantInsightApi | null) => {
        if (!d || !d.indicators) { setStatus("empty"); return; }
        setData(d);
        setStatus("ok");
      })
      .catch(() => setStatus("empty"));
  }, [articleId, ticker]);

  useEffect(() => {
    if (status !== "ok" || !data) {
      setAiOpinion(null);
      setAiOpinionLoading(false);
      return;
    }
    const payload = buildOpinionPayload(data, {
      title: articleTitle,
      excerpt: articleExcerpt,
    });
    let cancelled = false;
    setAiOpinionLoading(true);
    setAiOpinion(null);
    fetch("/api/quant/ai-opinion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          j: {
            lines?: string[];
            source?: string;
            layout?: QuantOpinionLayout;
          } | null
        ) => {
          if (cancelled || !j) return;
          const source = j.source === "gemini" ? "gemini" : "template";
          let lines = Array.isArray(j.lines) ? j.lines.slice(0, 2) : [];
          if (lines.length < 2) {
            lines = templateQuantOpinionKo(payload);
          }
          const layout =
            j.layout && j.layout.bullets?.length
              ? j.layout
              : buildQuantOpinionLayout(payload, lines, source);
          if (!layout.bullets?.length) return;
          setAiOpinion({
            layout,
            source: j.source ?? "template",
          });
        }
      )
      .catch(() => {
        if (!cancelled) setAiOpinion(null);
      })
      .finally(() => {
        if (!cancelled) setAiOpinionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, data, articleTitle, articleExcerpt]);

  const chartBlock =
    resolvedChartTickers.length > 0 ? (
      <>
        <Divider />
        <PostPublishCumReturnChart
          embedded
          articleId={articleId}
          tickers={resolvedChartTickers}
          tickerNames={chartTickerNames}
        />
      </>
    ) : null;

  if (status === "loading") {
    return (
      <aside className={asideClass("article-quant-sidebar", className)} aria-label="퀀트 인사이트 로딩 중">
        <QuantSkeletonBody />
        {chartBlock}
      </aside>
    );
  }

  if (status === "empty" || !data) {
    return (
      <aside className={asideClass("article-quant-sidebar", className)} aria-label="퀀트 인사이트">
        <p className="article-quant-sidebar__heading">퀀트 인사이트</p>
        <p style={{ fontSize: "0.75rem", color: "var(--quant-muted)", lineHeight: 1.55, margin: 0 }}>
          이 기사의 EOD 데이터가 없어 지표를 계산할 수 없습니다.
        </p>
        {chartBlock}
      </aside>
    );
  }

  const { indicators: ind, score, grade, trend_filter } = data;

  const fmt = (v: number | null, dec = 1) =>
    v !== null ? v.toFixed(dec) : "—";

  return (
    <aside className={asideClass("article-quant-sidebar", className)} aria-label="퀀트 인사이트">
      <p className="article-quant-sidebar__heading">퀀트 인사이트</p>
      {data.ticker && /^\d{6}$/.test(data.ticker) ? (
        <p className="article-quant-sidebar__analysis-ticker">
          분석 종목 · {data.ticker}
          {chartTickerNames?.[data.ticker]
            ? ` · ${chartTickerNames[data.ticker]}`
            : ""}
        </p>
      ) : null}

      {/* 종합: 오브에 등급+태도 한 번만, 옆은 표시 점수·한 줄 설명 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">총점(참고)</span>
        <div className="article-quant-sidebar__score-card">
          <AiScoreOrb grade={grade} />
          <div className="article-quant-sidebar__score-meta">
            <div className="article-quant-sidebar__score-row">
              <span className="article-quant-sidebar__score-num">{score.total}</span>
              <span className="article-quant-sidebar__score-denom">점</span>
            </div>
            <MiniBar value={quantStanceBarPct(grade)} gradient={quantStanceBarGradient(grade)} />
          </div>
        </div>
        {aiOpinionLoading ? (
          <div className="article-quant-sidebar__ai-opinion" aria-busy="true">
            <div className="article-quant-sidebar__ai-opinion-card article-quant-sidebar__ai-opinion-card--skel">
              <div className="article-quant-sidebar__ai-opinion-skel article-quant-sidebar__ai-opinion-skel--title" />
              <div className="article-quant-sidebar__ai-opinion-skel" />
              <div
                className="article-quant-sidebar__ai-opinion-skel"
                style={{ width: "92%" }}
              />
              <div
                className="article-quant-sidebar__ai-opinion-skel"
                style={{ width: "78%" }}
              />
              <div className="article-quant-sidebar__ai-opinion-skel article-quant-sidebar__ai-opinion-skel--takeaway" />
            </div>
          </div>
        ) : aiOpinion ? (
          <div className="article-quant-sidebar__ai-opinion">
            <div className="article-quant-sidebar__ai-opinion-card">
              <div className="article-quant-sidebar__ai-opinion-head">
                <span className="article-quant-sidebar__ai-opinion-kicker">
                  핵심 패턴
                </span>
                <p className="article-quant-sidebar__ai-opinion-title">
                  {aiOpinion.layout.signalLabel}
                </p>
              </div>
              <ul
                className="article-quant-sidebar__ai-opinion-bullets"
                aria-label="지표 해석 요점"
              >
                {aiOpinion.layout.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="article-quant-sidebar__ai-opinion-bullet"
                  >
                    {b}
                  </li>
                ))}
              </ul>
              <div
                className="article-quant-sidebar__ai-opinion-takeaway"
                role="note"
              >
                <span className="article-quant-sidebar__ai-opinion-takeaway-label">
                  한 줄 정리
                </span>
                <p className="article-quant-sidebar__ai-opinion-takeaway-text">
                  {aiOpinion.layout.takeaway}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Divider />

      {/* 상세 분석: 한 버튼으로 직렬 요약 → 펼치면 전체 */}
      <div className="article-quant-sidebar__detail-master">
        <button
          type="button"
          className="article-quant-sidebar__detail-master-btn"
          onClick={() => setDetailOpen((o) => !o)}
          aria-expanded={detailOpen}
          aria-controls={detailPanelId}
          aria-label={detailOpen ? "상세 분석 접기" : "상세 분석 펼치기"}
        >
          <span className="article-quant-sidebar__detail-serial" aria-hidden>
            <span>핵심 지표</span>
            <span className="article-quant-sidebar__detail-serial-sep">·</span>
            <span>시그널</span>
            <span className="article-quant-sidebar__detail-serial-sep">·</span>
            <span>추세</span>
            <span className="article-quant-sidebar__detail-serial-sep">·</span>
            <span>펀더멘탈</span>
          </span>
          <span className="article-quant-sidebar__detail-chevron" aria-hidden>
            {detailOpen ? "▾" : "▸"}
          </span>
        </button>
      </div>

      {detailOpen ? (
        <div id={detailPanelId} className="article-quant-sidebar__detail-panel">
      {/* 핵심 지표 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">
          핵심 지표 (5분봉→일봉, 발행 시각)
        </span>
        {/* ATR 비율 — 가중치 30, AUC 0.569 */}
        <Row
          label="ATR 비율 (w30)"
          value={`${fmt(ind.atr_ratio)}%`}
          color={
            ind.atr_ratio === null ? undefined
              : ind.atr_ratio <= 6.5  ? "var(--quant-up)"
              : ind.atr_ratio > 7.1   ? "var(--quant-down)"
              : undefined
          }
        />
        {/* 거래량 비율 — 가중치 25, 과대=악재 */}
        <Row
          label="거래량 비율 (w25)"
          value={
            ind.vol_ratio20 !== null
              ? `${fmt(ind.vol_ratio20, 2)}×`
              : "—"
          }
          color={
            ind.vol_ratio20 === null ? undefined
              : ind.vol_ratio20 < 1.0  ? "var(--quant-up)"
              : ind.vol_ratio20 >= 2.0 ? "var(--quant-down)"
              : undefined
          }
        />
        {/* MA5-20 이격 — 가중치 20, AUC 0.529 */}
        <Row
          label="MA5-20 이격 (w20)"
          value={`${fmt(ind.ma5_20_spread)}%`}
          color={
            ind.ma5_20_spread === null ? undefined
              : ind.ma5_20_spread <= 1.5  ? "var(--quant-up)"
              : ind.ma5_20_spread > 3.5   ? "var(--quant-down)"
              : undefined
          }
        />
        {/* 10일 모멘텀 — 가중치 10, AUC 0.525 */}
        <Row
          label="10일 모멘텀 (w10)"
          value={`${ind.momentum10d !== null && ind.momentum10d > 0 ? "+" : ""}${fmt(ind.momentum10d)}%`}
          color={
            ind.momentum10d === null ? undefined
              : ind.momentum10d < 0    ? "var(--quant-up)"
              : ind.momentum10d > 5    ? "var(--quant-down)"
              : undefined
          }
        />
        {/* BB %B — 가중치 10, AUC 0.526 (WIN=LOSS≈0.70) */}
        <Row
          label="BB %B (w10)"
          value={fmt(ind.bb_pct_b, 2)}
          color={
            ind.bb_pct_b === null ? undefined
              : ind.bb_pct_b <= 0.40 ? "var(--quant-up)"
              : ind.bb_pct_b >= 0.85 ? "var(--quant-down)"
              : undefined
          }
        />
        {/* RSI 14 — 가중치 5, AUC 0.507 (신호 미미) */}
        <Row
          label="RSI 14 (w5)"
          value={fmt(ind.rsi14)}
          color={
            ind.rsi14 === null ? undefined
              : ind.rsi14 < 30 ? "var(--quant-up)"
              : ind.rsi14 > 70 ? "var(--quant-down)"
              : undefined
          }
        />
      </div>

      <Divider />

      {/* 트렌드 필터 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">가격 위치(20일 평균 기준)</span>
        <Row
          label="평균보다"
          value={trend_filter.above_ma20 ? "위 ↑" : "아래 ↓"}
          color={trend_filter.above_ma20 ? "var(--quant-up)" : "var(--quant-down)"}
        />
        <Row
          label="최근 10일 흐름"
          value={
            trend_filter.momentum_direction === "FALLING" ? "하락 ↓"
              : trend_filter.momentum_direction === "RISING" ? "상승 ↑"
              : "횡보"
          }
          color={
            trend_filter.momentum_direction === "FALLING" ? "var(--quant-up)"
              : trend_filter.momentum_direction === "RISING" ? "var(--quant-down)"
              : undefined
          }
        />
        {trend_filter.contrarian_setup && (
          <div
            style={{
              marginTop: "0.35rem",
              fontSize: "0.625rem",
              color: "var(--quant-up)",
              padding: "0.25rem 0.5rem",
              background: "color-mix(in srgb, var(--quant-up) 8%, transparent)",
              borderRadius: 4,
              lineHeight: 1.4,
            }}
          >
            눌림 뒤 반등을 노리기 좋은 조합으로 자주 쓰입니다(과거 통계 참고).
          </div>
        )}
      </div>

      <Divider />

      {data.fundamentals_snapshot != null ? (
        <FundamentalsBlock
          embeddedInPanel
          snap={data.fundamentals_snapshot}
          fscore={data.fundamental_score}
          krxCode={data.ticker}
          krxDisplayName={
            data.ticker && chartTickerNames?.[data.ticker]
              ? chartTickerNames[data.ticker]
              : undefined
          }
        />
      ) : (
        <div className="article-quant-sidebar__fundamentals article-quant-sidebar__fundamentals--in-panel">
          <span className="article-quant-sidebar__label">펀더멘탈</span>
          <p className="article-quant-sidebar__fundamentals-empty">
            이 환경에 펀더멘탈 요약 파일이 없어 표시할 수 없습니다.
          </p>
        </div>
      )}
      </div>
      ) : null}

      {chartBlock}
    </aside>
  );
}
