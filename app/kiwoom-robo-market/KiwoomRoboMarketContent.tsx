import Link from "next/link";
import { sb } from "@/app/article/[newsId]/sidebar-tokens";
import type { DailyOhlc } from "@/lib/stock-chart-api";
import type { KiwoomBandMeta, RoboPriceBands } from "@/lib/kiwoom-robo-bands";
import { KiwoomRoboCandleChart } from "./KiwoomRoboCandleChart";

type Props = {
  articleTitle: string;
  articleNewsId: string | null;
  ohlc: DailyOhlc[];
  bands: RoboPriceBands | null;
  bandMeta: KiwoomBandMeta | null;
  lastClose: number | null;
  ticker: string;
  tickerName: string;
  centerDate: string;
  chartError: string | null;
  usedFallbackTicker: boolean;
  /** Python·CSV 없는 배포 환경용 합성 일봉 */
  usedSyntheticOhlc?: boolean;
};

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatYmd(ymd: string): string {
  if (ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function KiwoomRoboMarketContent({
  articleTitle,
  articleNewsId,
  ohlc,
  bands,
  bandMeta,
  lastClose,
  ticker,
  tickerName,
  centerDate,
  chartError,
  usedFallbackTicker,
  usedSyntheticOhlc = false,
}: Props) {
  const hasChart = ohlc.length > 0 && bands != null && lastClose != null;

  return (
    <div style={{ maxWidth: "44rem" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: sb.accent,
              background: sb.accentSoft,
              borderRadius: 9999,
              padding: "0.35rem 0.65rem",
            }}
          >
            매수 우위
          </span>
          {lastClose != null && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: sb.muted,
                background: "#fff",
                border: `1px solid ${sb.border}`,
                borderRadius: 9999,
                padding: "0.35rem 0.65rem",
              }}
            >
              종가(최근 봉) {formatWon(lastClose)}
            </span>
          )}
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: sb.text,
              background: sb.grid,
              border: `1px solid ${sb.border}`,
              borderRadius: 9999,
              padding: "0.35rem 0.65rem",
            }}
          >
            {tickerName} ({ticker})
            {usedFallbackTicker && (
              <span style={{ color: sb.muted, fontWeight: 500 }}> · 뉴스 티커 없음, 기본 종목</span>
            )}
          </span>
        </div>
        {articleNewsId ? (
          <Link
            href={`/article/${articleNewsId}`}
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              lineHeight: 1.5,
              color: "var(--color-text)",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
            className="kiwoom-article-title"
          >
            {articleTitle}
          </Link>
        ) : (
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              lineHeight: 1.5,
              margin: 0,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
            }}
          >
            {articleTitle}
          </h1>
        )}
        <p style={{ fontSize: "0.875rem", color: sb.muted, marginTop: "0.75rem", marginBottom: 0, lineHeight: 1.55 }}>
          {usedSyntheticOhlc ? (
            <>
              배포·서버 환경에서는 로컬 <code style={{ fontSize: "0.8em" }}>ls_stock_1d</code> CSV와{" "}
              <code style={{ fontSize: "0.8em" }}>python3</code> 파이프라인을 쓸 수 없어, 동일 계산 로직 검증용{" "}
              <strong style={{ color: sb.text }}>합성 일봉</strong>을 씁니다. 기준일{" "}
              <strong style={{ color: sb.text }}>{formatYmd(centerDate)}</strong> 전후입니다.{" "}
            </>
          ) : (
            <>
              일봉은 저장소의 <code style={{ fontSize: "0.8em" }}>ls_stock_1d</code> CSV를{" "}
              <code style={{ fontSize: "0.8em" }}>scripts/stock_chart_data.py</code>로 읽어옵니다. 기준일{" "}
              <strong style={{ color: sb.text }}>{formatYmd(centerDate)}</strong> 전후 구간입니다.{" "}
            </>
          )}
          {bandMeta == null && !usedSyntheticOhlc && "일봉이 로드되면 점선 구간은 ATR·종가 기준으로 계산합니다."}
          {bandMeta?.mode === "atr" && (
            <>점선 구간은 최근 종가·ATR({bandMeta.atrPeriod})로 산출한 매수·익절 범위입니다.</>
          )}
          {bandMeta?.mode === "pct_fallback" && (
            <>점선 구간은 ATR 산출이 불가할 때 종가 대비 비율로 둔 참고선입니다.</>
          )}
        </p>
      </header>

      <div
        style={{
          borderRadius: "18px",
          border: `1px solid ${sb.border}`,
          background: "#ffffff",
          padding: "1rem 1rem 0.85rem",
          marginBottom: "1.15rem",
          boxShadow: "0 8px 30px -20px rgba(15,23,42,0.22)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
          <LegendChip label="매수 적정" />
          <LegendChip label="1차 수익실현" />
          <LegendChip label="2차 수익실현" />
        </div>
        {chartError && (
          <div
            style={{
              padding: "1.25rem",
              fontSize: "0.875rem",
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              marginBottom: "0.5rem",
            }}
          >
            {chartError}
          </div>
        )}
        {hasChart && bands && <KiwoomRoboCandleChart ohlc={ohlc} bands={bands} />}
        <p
          style={{
            fontSize: "0.625rem",
            color: sb.faint,
            marginTop: "0.5rem",
            marginBottom: 0,
            lineHeight: 1.45,
          }}
        >
          렌더: TradingView{" "}
          <a
            href="https://www.tradingview.com/lightweight-charts/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: sb.accent, textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            Lightweight Charts
          </a>
          · 데이터 소스: 로컬 일봉 CSV
        </p>
      </div>

      {hasChart && bands && bandMeta && (
        <div
          style={{
            marginTop: "0.25rem",
            borderTop: `1px solid ${sb.border}`,
            fontSize: "0.8125rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <BandLine label="매수 적정 범위" value={`${formatWon(bands.buyLow)} – ${formatWon(bands.buyHigh)}`} />
          <BandLine
            label="1차 수익실현"
            value={`${formatWon(bands.tp1Low)} – ${formatWon(bands.tp1High)}`}
            trailing={`보수적 ${bandMeta.expectedReturnTp1Pct >= 0 ? "+" : ""}${formatPct(bandMeta.expectedReturnTp1Pct)}`}
          />
          <BandLine
            label="2차 수익실현"
            value={`${formatWon(bands.tp2Low)} – ${formatWon(bands.tp2High)}`}
            trailing={`보수적 ${bandMeta.expectedReturnTp2Pct >= 0 ? "+" : ""}${formatPct(bandMeta.expectedReturnTp2Pct)}`}
            last
          />
          <RoboBandMetrics meta={bandMeta} formatWon={formatWon} />
        </div>
      )}
    </div>
  );
}

function RoboBandMetrics({
  meta,
  formatWon,
}: {
  meta: KiwoomBandMeta;
  formatWon: (n: number) => string;
}) {
  const parts: string[] = [];
  if (meta.atr != null) {
    parts.push(`ATR(${meta.atrPeriod}) ${formatWon(Math.round(meta.atr))}`);
  }
  if (meta.zScore != null) {
    parts.push(`Z ${meta.zScore.toFixed(2)}`);
  }
  if (meta.prevHigh70 != null) {
    parts.push(`이전고점×0.7 ${formatWon(meta.prevHigh70)}`);
  }
  parts.push("표시 수익률: 비용·슬리피지 반영, 일 ATR 대비 상한");
  if (parts.length === 0) return null;
  return (
    <p
      style={{
        margin: "0.65rem 0 0",
        paddingTop: "0.55rem",
        borderTop: `1px solid ${sb.border}`,
        fontSize: "0.6875rem",
        lineHeight: 1.5,
        color: sb.faint,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {parts.join(" · ")}
    </p>
  );
}

function LegendChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "0.625rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        color: "#64748b",
        background: "#f8fafc",
        border: `1px solid ${sb.border}`,
        borderRadius: "6px",
        padding: "0.35rem 0.65rem",
      }}
    >
      {label}
    </span>
  );
}

function BandLine({
  label,
  value,
  trailing,
  last,
}: {
  label: string;
  value: string;
  /** 예상 수익률 등 보조 표시 */
  trailing?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "0.35rem 0.75rem",
        padding: "0.5rem 0",
        borderBottom: last ? "none" : `1px solid ${sb.border}`,
      }}
    >
      <span style={{ color: sb.muted, fontWeight: 500 }}>{label}</span>
      <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem 0.75rem" }}>
        <span style={{ color: sb.text, fontWeight: 600 }}>{value}</span>
        {trailing && (
          <span style={{ color: sb.accent, fontWeight: 600, fontSize: "0.8125rem" }}>{trailing}</span>
        )}
      </span>
    </div>
  );
}
