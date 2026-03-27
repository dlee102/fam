import { qLabel, sb } from "./sidebar-tokens";
import { ROBO_DEMO } from "@/app/kiwoom-robo-market/demo";

/** 기사 퀀트 대시보드용 — 키움 로보마켓 (데모 구간) */
const DEMO = {
  aiScore: 78,
  aiLabel: "매수 우위",
  riskBand: "중간",
  riskScore: 42,
  regime: "변동성 확대",
  price: ROBO_DEMO.price,
};

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function RoboMarketInsightCard() {
  const p = DEMO.price;
  const scaleMin = Math.min(p.buyLow, p.tp1Low) - 25_000;
  const scaleMax = p.tp2High + 25_000;
  const span = scaleMax - scaleMin;
  const pct = (v: number) => ((v - scaleMin) / span) * 100;
  const lastPct = pct(p.last);

  return (
    <section style={{ fontVariantNumeric: "tabular-nums", margin: 0, padding: 0, border: "none" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.85rem",
        }}
      >
        <div style={{ ...qLabel, marginBottom: 0 }}>키움 로보마켓</div>
        <span
          style={{
            fontSize: "0.5625rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: sb.accent,
            backgroundColor: sb.accentSoft,
            padding: "4px 8px",
            borderRadius: "999px",
            flexShrink: 0,
          }}
        >
          샘플
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.85rem",
          marginBottom: "0.85rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.625rem", color: sb.faint, fontWeight: 600, marginBottom: "0.35rem" }}>AI 투자 점수</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.35rem", fontWeight: 700, color: sb.accent, letterSpacing: "-0.02em" }}>
              {DEMO.aiScore}
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: sb.muted }}> / 100</span>
            </span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: sb.text }}>{DEMO.aiLabel}</span>
          </div>
          <div style={{ height: "6px", backgroundColor: sb.grid, borderRadius: 9999, overflow: "hidden" }}>
            <div
              style={{
                width: `${DEMO.aiScore}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${sb.accent} 0%, #14b8a6 100%)`,
                borderRadius: 9999,
              }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", color: sb.faint, fontWeight: 600, marginBottom: "0.35rem" }}>리스크 구간</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: sb.text, marginBottom: "0.45rem" }}>
            {DEMO.riskBand}
            <span style={{ fontWeight: 600, color: sb.muted }}> · {DEMO.riskScore}</span>
          </div>
          <div style={{ position: "relative", height: "8px", borderRadius: 9999, overflow: "visible" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 9999,
                background: "linear-gradient(90deg, #16a34a 0%, #eab308 52%, #dc2626 100%)",
                opacity: 0.88,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${DEMO.riskScore}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#fff",
                border: `2px solid ${sb.text}`,
                boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
                zIndex: 1,
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem 0.75rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.625rem", color: sb.faint, fontWeight: 600 }}>시장 레짐</span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: sb.text,
            background: sb.grid,
            padding: "4px 10px",
            borderRadius: "8px",
            border: `1px solid ${sb.border}`,
          }}
        >
          {DEMO.regime}
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: sb.muted, marginBottom: "0.5rem" }}>
        현재가 <span style={{ fontWeight: 600, color: sb.text }}>{formatWon(p.last)}</span>
      </div>

      <div style={{ fontSize: "0.625rem", color: sb.faint, fontWeight: 600, marginBottom: "0.35rem" }}>가격대 구간 (데모)</div>
      <div
        style={{
          position: "relative",
          height: "22px",
          borderRadius: "8px",
          overflow: "hidden",
          background: sb.grid,
          border: `1px solid ${sb.border}`,
          marginBottom: "0.4rem",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${pct(p.buyLow)}%`,
            width: `${pct(p.buyHigh) - pct(p.buyLow)}%`,
            height: "100%",
            background: "rgba(13, 148, 136, 0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${pct(p.tp1Low)}%`,
            width: `${pct(p.tp1High) - pct(p.tp1Low)}%`,
            height: "100%",
            background: "rgba(234, 179, 8, 0.28)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${pct(p.tp2Low)}%`,
            width: `${pct(p.tp2High) - pct(p.tp2Low)}%`,
            height: "100%",
            background: "rgba(67, 56, 202, 0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${lastPct}%`,
            top: 0,
            bottom: 0,
            width: "2px",
            marginLeft: "-1px",
            background: sb.text,
            boxShadow: "0 0 0 1px #fff",
            zIndex: 2,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.5625rem", color: sb.faint, marginBottom: "0.65rem" }}>
        <span>{formatWon(scaleMin)}</span>
        <span>{formatWon(scaleMax)}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.75rem" }}>
        <div>
          <span style={{ fontWeight: 600, color: sb.accent }}>매수 적정 </span>
          <span style={{ color: sb.muted }}>
            {formatWon(p.buyLow)} ~ {formatWon(p.buyHigh)}
          </span>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "#a16207" }}>1차 익절 </span>
          <span style={{ color: sb.muted }}>
            {formatWon(p.tp1Low)} ~ {formatWon(p.tp1High)}
          </span>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "#4338ca" }}>2차 익절 </span>
          <span style={{ color: sb.muted }}>
            {formatWon(p.tp2Low)} ~ {formatWon(p.tp2High)}
          </span>
        </div>
      </div>
    </section>
  );
}
