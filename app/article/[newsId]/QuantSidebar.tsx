"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArticleSentimentSnapshot } from "@/lib/article-sentiment";
import type { QuantInsight } from "@/lib/quant-engine";
import { AiScoreOrb } from "./AiScoreOrb";
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

function sentimentLabelColor(labelKo: string): string {
  if (labelKo === "긍정") return "var(--quant-up)";
  if (labelKo === "부정") return "var(--quant-down)";
  return "var(--quant-muted)";
}

function ArticleToneBlock({ sentiment }: { sentiment: ArticleSentimentSnapshot }) {
  const fg = sentimentLabelColor(sentiment.labelKo);
  const confPct =
    sentiment.confidence != null && Number.isFinite(sentiment.confidence)
      ? `${Math.round(sentiment.confidence * 100)}%`
      : null;
  return (
    <div
      className="article-quant-sidebar__section"
      style={{ marginBottom: "0.85rem" }}
    >
      <span className="article-quant-sidebar__label">기사 톤 (AI)</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center", marginTop: "0.35rem" }}>
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: fg,
            background: `color-mix(in srgb, ${fg} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${fg} 35%, transparent)`,
            borderRadius: "6px",
            padding: "0.2rem 0.55rem",
            letterSpacing: "0.02em",
          }}
        >
          {sentiment.labelKo}
        </span>
        {confPct ? (
          <span style={{ fontSize: "0.625rem", color: "var(--quant-faint)" }}>신뢰도 {confPct}</span>
        ) : null}
      </div>
      {(sentiment.primaryTypeKo || sentiment.catalystLabelKo) && (
        <div
          style={{
            marginTop: "0.45rem",
            fontSize: "0.6875rem",
            color: "var(--quant-muted)",
            lineHeight: 1.45,
          }}
        >
          {sentiment.primaryTypeKo ? (
            <span>
              유형: <strong style={{ color: "var(--color-text)" }}>{sentiment.primaryTypeKo}</strong>
            </span>
          ) : null}
          {sentiment.primaryTypeKo && sentiment.catalystLabelKo ? " · " : null}
          {sentiment.catalystLabelKo ? (
            <span>
              촉매: <strong style={{ color: "var(--color-text)" }}>{sentiment.catalystLabelKo}</strong>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
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

// ── 등급 색상 ──────────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: "var(--quant-up)",
  B: "#0ea5e9",
  C: "var(--quant-muted)",
  D: "var(--quant-down)",
};

const SIGNAL_COLOR: Record<string, string> = {
  AGGRESSIVE_CONTRARIAN: "var(--quant-up)",
  VOLATILITY_SQUEEZE:    "#0ea5e9",
  OVERSOLD_REBOUND:      "#0891b2",
  MOMENTUM_WARNING:      "var(--quant-down)",
  NEUTRAL:               "var(--quant-muted)",
};

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
  /** classified JSON 기반 긍정/부정/중립 등 */
  articleSentiment?: ArticleSentimentSnapshot | null;
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

export function QuantSidebar({
  articleId,
  ticker,
  className,
  chartTickers,
  chartTickerNames,
  articleSentiment,
}: Props) {
  const [data, setData] = useState<QuantInsight | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty">("loading");

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
      .then((d: QuantInsight | null) => {
        if (!d || !d.indicators) { setStatus("empty"); return; }
        setData(d);
        setStatus("ok");
      })
      .catch(() => setStatus("empty"));
  }, [articleId, ticker]);

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

  const toneEl = articleSentiment ? <ArticleToneBlock sentiment={articleSentiment} /> : null;

  if (status === "loading") {
    return (
      <aside className={asideClass("article-quant-sidebar", className)} aria-label="퀀트 인사이트 로딩 중">
        {toneEl}
        <QuantSkeletonBody />
        {chartBlock}
      </aside>
    );
  }

  if (status === "empty" || !data) {
    return (
      <aside className={asideClass("article-quant-sidebar", className)} aria-label="퀀트 인사이트">
        <p className="article-quant-sidebar__heading">퀀트 인사이트</p>
        {toneEl}
        <p style={{ fontSize: "0.75rem", color: "var(--quant-muted)", lineHeight: 1.55, margin: 0 }}>
          이 기사의 EOD 데이터가 없어 지표를 계산할 수 없습니다.
        </p>
        {chartBlock}
      </aside>
    );
  }

  const { indicators: ind, score, grade, primary_signal, all_signals, trend_filter, entry } = data;

  const fmt = (v: number | null, dec = 1) =>
    v !== null ? v.toFixed(dec) : "—";

  return (
    <aside className={asideClass("article-quant-sidebar", className)} aria-label="퀀트 인사이트">
      {/* 헤딩 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p className="article-quant-sidebar__heading" style={{ margin: 0 }}>퀀트 인사이트</p>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: GRADE_COLOR[grade] ?? "var(--quant-muted)",
            background: `color-mix(in srgb, ${GRADE_COLOR[grade] ?? "#888"} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${GRADE_COLOR[grade] ?? "#888"} 30%, transparent)`,
            borderRadius: "4px",
            padding: "0.125rem 0.5rem",
            letterSpacing: "0.05em",
          }}
        >
          {grade}등급
        </span>
      </div>

      {toneEl}

      {/* 종합 점수 — 자비스 스타일 원형 오브 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">종합 점수</span>
        <div className="article-quant-sidebar__score-card">
          <AiScoreOrb score={score.total} grade={grade} />
          <div className="article-quant-sidebar__score-meta">
            <div className="article-quant-sidebar__score-row">
              <span className="article-quant-sidebar__score-denom">0–100</span>
            </div>
            <MiniBar value={score.total} />
            <p className="article-quant-sidebar__score-caption">
              기술 지표 캘리브 후 기사 톤(긍정/부정)을 <strong>소폭 반영</strong>
              {score.sentiment_nudge !== 0 ? (
                <>
                  {" "}
                  (<strong>{score.sentiment_nudge > 0 ? "+" : ""}{score.sentiment_nudge}</strong>점)
                </>
              ) : null}
              . 표시는 <strong>최소 50</strong> 클램프. 등급·진입은 raw{" "}
              <strong>{score.raw_weighted}</strong> 기준.
            </p>
          </div>
        </div>
      </div>

      <Divider />

      {/* 핵심 지표 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">
          {data.bar_source === "5m_agg"
            ? "핵심 지표 (5분봉→일봉, 발행 시각)"
            : "핵심 지표 (EOD 일봉)"}
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

      {/* 시그널 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">탐지 시그널</span>
        {all_signals.length === 0 ? (
          <span style={{ fontSize: "0.75rem", color: "var(--quant-muted)" }}>감지된 시그널 없음</span>
        ) : (
          all_signals.map((sig) => (
            <div key={sig.type} style={{ marginBottom: "0.5rem" }}>
              <div className="article-quant-sidebar__row" style={{ marginBottom: "0.2rem" }}>
                <span
                  className="article-quant-sidebar__row-key"
                  style={{ color: SIGNAL_COLOR[sig.type] ?? "var(--quant-muted)", fontWeight: 600 }}
                >
                  {sig.label}
                </span>
                <span style={{ fontSize: "0.625rem", color: "var(--quant-faint)" }}>
                  {sig.confidence}
                </span>
              </div>
              <MiniBar
                value={sig.strength}
                gradient={
                  sig.type === "MOMENTUM_WARNING"
                    ? "var(--quant-risk-gradient)"
                    : undefined
                }
              />
              {sig.expected_return_pct !== null && (
                <div style={{ fontSize: "0.625rem", color: "var(--quant-faint)", marginTop: "0.2rem" }}>
                  기대수익: {sig.expected_return_pct > 0 ? "+" : ""}{sig.expected_return_pct}%
                  {sig.expected_pf !== null ? ` · PF ${sig.expected_pf}` : ""}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Divider />

      {/* 트렌드 필터 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">추세 조건</span>
        <Row
          label="MA20 위치"
          value={trend_filter.above_ma20 ? "위 ↑" : "아래 ↓"}
          color={trend_filter.above_ma20 ? "var(--quant-up)" : "var(--quant-down)"}
        />
        <Row
          label="10일 추세"
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
            역발상 세팅 감지 (+1.03% 기대)
          </div>
        )}
      </div>

      <Divider />

      {/* 진입 추천 */}
      <div className="article-quant-sidebar__section">
        <span className="article-quant-sidebar__label">진입 추천</span>
        <Row label="진입 시점" value={entry.timing_label} />
        <Row
          label="보유 기간"
          value={entry.hold_trading_days > 0 ? `${entry.hold_trading_days}거래일` : "진입 비권고"}
          color={entry.hold_trading_days === 0 ? "var(--quant-down)" : undefined}
        />
        {entry.stop_loss_pct !== null && (
          <Row label="ATR 손절" value={`-${entry.stop_loss_pct}%`} color="var(--quant-down)" />
        )}
      </div>
      {chartBlock}
    </aside>
  );
}
