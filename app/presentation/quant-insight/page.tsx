"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useCallback, useEffect, useRef } from "react";

const T = {
  shell: "#0a0a0b",
  shellHairline: "rgba(255,255,255,0.07)",
  chromeFg: "rgba(250,250,249,0.88)",
  chromeFgMuted: "rgba(250,250,249,0.42)",
  canvas: "#f7f6f4",
  surface: "#ffffff",
  ink: "#111111",
  inkSec: "#4a4a4a",
  inkTer: "#737373",
  accent: "#1c4d48",
  accentMuted: "rgba(28,77,72,0.10)",
  rule: "rgba(0,0,0,0.06)",
  ruleStrong: "rgba(0,0,0,0.10)",
  up: "#15803d",
  down: "#b91c1c",
  warn: "#a16207",
} as const;

const SZ = 24;
const SVG = {
  width: SZ, height: SZ, viewBox: "0 0 24 24",
  fill: "none" as const, stroke: "currentColor",
  strokeWidth: 1.65, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

/* ── 공통 PPT 컴포넌트 ─────────────────────────────────────────── */
function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: T.surface, border: `1px solid ${T.rule}`, borderRadius: 2,
      padding: "clamp(1rem,2.5vw,2.25rem)", ...style }}>
      {children}
    </div>
  );
}

function Tag({ label, color = T.accent }: { label: string; color?: string }) {
  return (
    <span style={{ display: "inline-block", fontSize: "clamp(0.7rem,1.15vw,1.0rem)", fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase" as const,
      color, background: `color-mix(in srgb, ${color} 10%, transparent)`,
      padding: "0.25rem 0.6rem", borderRadius: 3, marginBottom: "0.55rem" }}>
      {label}
    </span>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
      <span style={{ color: T.accent, flexShrink: 0, marginTop: 3 }}>▸</span>
      <span style={{ fontSize: "clamp(0.92rem,1.85vw,1.25rem)", color: T.inkSec, lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

/* ── 2단 슬라이드 레이아웃 ─────────────────────────────────────── */
function TwoCol({ mock, desc }: { mock: ReactNode; desc: ReactNode; mockWidth?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "clamp(260px,28vw,540px) 1fr", gap: "clamp(1.5rem,3.5vw,3.5rem)",
      alignItems: "start", height: "100%", minHeight: 0 }}>
      {/* 왼쪽: 실제 카드 목업 */}
      <div style={{ position: "sticky", top: 0 }}>
        <div style={{ fontSize: "clamp(0.68rem,1.0vw,0.9rem)", fontWeight: 600, letterSpacing: "0.12em", color: T.inkTer,
          textTransform: "uppercase", marginBottom: "0.6rem" }}>실제 화면</div>
        <div style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12)", borderRadius: 6, overflow: "hidden" }}>
          {mock}
        </div>
      </div>
      {/* 오른쪽: 설명 */}
      <div>
        <div style={{ fontSize: "clamp(0.68rem,1.0vw,0.9rem)", fontWeight: 600, letterSpacing: "0.12em", color: T.inkTer,
          textTransform: "uppercase", marginBottom: "1rem" }}>설명</div>
        {desc}
      </div>
    </div>
  );
}

/* ── 사이드바 목업 공통 래퍼 ──────────────────────────────────── */
function SbWrap({ children }: { children: ReactNode }) {
  return (
    <div style={{ backgroundColor: T.surface, fontFamily: "inherit",
      padding: "clamp(0.85rem,1.5vw,1.75rem)", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      {children}
    </div>
  );
}
function SbLabel({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: "clamp(0.68rem,1.05vw,1.0rem)", fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase" as const, color: T.inkTer, marginBottom: "clamp(0.2rem,0.4vw,0.45rem)",
    display: "block" }}>{children}</span>;
}
function SbRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "clamp(0.28rem,0.5vw,0.55rem) 0", borderBottom: `1px solid ${T.rule}` }}>
      <span style={{ fontSize: "clamp(0.8rem,1.3vw,1.1rem)", color: T.inkSec }}>{label}</span>
      <span style={{ fontSize: "clamp(0.85rem,1.4vw,1.18rem)", fontWeight: 700, color: color ?? T.ink,
        fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
function SbBar({ pct, gradient }: { pct: number; gradient?: string }) {
  return (
    <div style={{ height: "clamp(5px,0.55vw,9px)", borderRadius: 3, background: T.rule, overflow: "hidden",
      margin: "clamp(0.3rem,0.5vw,0.6rem) 0" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, pct))}%`, borderRadius: 3,
        background: gradient ?? T.accent }} />
    </div>
  );
}

/* ── 슬라이드 정의 ──────────────────────────────────────────────── */
const SLIDES: Array<{ label: string; title: string; subtitle: string; content: ReactNode }> = [

  /* 0. COVER */
  {
    label: "INTRO",
    title: "기사 기반 퀀트 인사이트",
    subtitle: "뉴스를 읽는 순간, 7가지 숫자가 실시간으로 붙습니다",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.5rem,4vw,2.5rem)" }}>
        <p style={{ fontSize: "clamp(1.15rem,2.7vw,1.5rem)", color: T.inkSec, lineHeight: 1.65, maxWidth: "50rem", margin: 0 }}>
          종목 뉴스 기사 한 페이지에서 <strong>종합 점수(퀀트+알고리즘) · AI 해석 · 핵심 지표 · 펀더멘탈 · 누적 수익률 곡선</strong>까지,
          투자 판단에 필요한 맥락을 즉시 확인합니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem" }}>
          {[
            { n: "①", k: "종합 점수", d: "퀀트 기술(80%) + 알고리즘(20%) 합산 · A~D 등급" },
            { n: "②", k: "알고리즘 시그널", d: "공개 시각·이평·갭·체결 6피처 → 종합의 20%" },
            { n: "③", k: "AI 해석 카드", d: "패턴 + 가격·손절 기반 한 줄 정리" },
            { n: "④", k: "핵심 지표", d: "ATR · 거래량 · MA · RSI" },
            { n: "⑤", k: "추세 필터", d: "MA20 위치 + 방향 + 4가지 국면 감지" },
            { n: "⑥", k: "펀더멘탈", d: "4축 재무 건전성 등급" },
            { n: "⑦", k: "수익률 곡선", d: "발행 전후 5분봉 누적" },
          ].map((it) => (
            <Card key={it.n} style={{ borderLeft: `3px solid ${T.accent}` }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: T.accent, lineHeight: 1, marginBottom: "0.5rem" }}>{it.n}</div>
              <div style={{ fontSize: "clamp(1rem,1.9vw,1.15rem)", fontWeight: 600, color: T.ink, marginBottom: "0.3rem" }}>{it.k}</div>
              <div style={{ fontSize: "clamp(0.9rem,1.65vw,1.0rem)", color: T.inkTer, lineHeight: 1.45 }}>{it.d}</div>
            </Card>
          ))}
        </div>
      </div>
    ),
  },

  /* 1. 종합 점수 */
  {
    label: "① 종합 점수",
    title: "종합 점수 — 퀀트 기술(80%) + 알고리즘(20%)",
    subtitle: "두 독립 스코어를 가중 합산한 0~100 표시 점수 · A/B/C/D 등급",
    content: (
      <TwoCol
        mock={
          <SbWrap>
            <p style={{ fontSize: "clamp(0.82rem,1.35vw,1.15rem)", fontWeight: 700, color: T.ink, margin: "0 0 0.55rem", letterSpacing: "0.04em" }}>
              퀀트 인사이트
            </p>
            <span style={{ fontSize: "clamp(0.68rem,1.05vw,0.9rem)", color: T.inkTer, marginBottom: "0.5rem", display: "block" }}>
              분석 종목 · 068270
            </span>
            {/* 종합 점수 섹션 */}
            <div style={{ background: T.canvas, borderRadius: 3, padding: "clamp(0.6rem,1.1vw,1.1rem)", marginBottom: "0.5rem" }}>
              <SbLabel>종합 점수(퀀트+알고리즘)</SbLabel>
              {/* 수식 뱃지 */}
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.55rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: T.inkTer,
                  background: `color-mix(in srgb,${T.accent} 8%,transparent)`,
                  padding: "0.18rem 0.5rem", borderRadius: 3, fontWeight: 600 }}>
                  퀀트 75점 × 80%
                </span>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: T.inkTer }}>+</span>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: T.inkTer,
                  background: `color-mix(in srgb,#2563eb 8%,transparent)`,
                  padding: "0.18rem 0.5rem", borderRadius: 3, fontWeight: 600 }}>
                  알고리즘 68점 × 20%
                </span>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: T.inkTer }}>= <strong>74점</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", margin: "0.2rem 0" }}>
                <span style={{ fontSize: "clamp(1.5rem,2.8vw,2.8rem)", fontWeight: 800, color: T.accent, lineHeight: 1 }}>74</span>
                <span style={{ fontSize: "clamp(0.8rem,1.3vw,1.1rem)", color: T.inkTer }}>점</span>
              </div>
              <SbBar pct={74} gradient="linear-gradient(90deg,#15803d80,#15803d)" />
              <div style={{ fontSize: "clamp(0.68rem,1.0vw,0.9rem)", color: T.inkTer, marginTop: "0.2rem" }}>등급 B · 알고리즘 데이터 있음</div>
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.75rem,1.4vw,1.25rem)" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2.1vw,1.45rem)", color: T.inkSec, lineHeight: 1.65 }}>
              기술 지표 6개(<strong>퀀트 점수</strong>)와 진입 조건 6개(<strong>알고리즘 점수</strong>)를
              <strong> 80:20</strong>으로 합산합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.55rem,1vw,0.9rem)" }}>
              <Card style={{ borderLeft: `3px solid ${T.accent}` }}>
                <div style={{ fontWeight: 700, color: T.accent, marginBottom: "0.3rem", fontSize: "clamp(0.88rem,1.6vw,1.15rem)" }}>
                  퀀트 기술 점수 (80%)
                </div>
                <div style={{ fontSize: "clamp(0.84rem,1.45vw,1.1rem)", color: T.inkSec, lineHeight: 1.55 }}>
                  ATR·거래량·MA이격·모멘텀·BB·RSI 6개 지표의 AUC 가중합. 변동성·눌림·과매도를 종합합니다.
                </div>
              </Card>
              <Card style={{ borderLeft: `3px solid #2563eb` }}>
                <div style={{ fontWeight: 700, color: "#2563eb", marginBottom: "0.3rem", fontSize: "clamp(0.88rem,1.6vw,1.15rem)" }}>
                  알고리즘 시그널 (20%)
                </div>
                <div style={{ fontSize: "clamp(0.84rem,1.45vw,1.1rem)", color: T.inkSec, lineHeight: 1.55 }}>
                  기사 공개 시각·전일 MA20 이격·갭·기준 체결가 6피처.
                </div>
              </Card>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.35rem,0.6vw,0.65rem)" }}>
              {[
                { g: "A", l: "강한 매수 (80점 이상)", c: T.up },
                { g: "B", l: "매수 우세 (65~79점)", c: T.up },
                { g: "C", l: "중립 (51~64점)", c: T.warn },
                { g: "D", l: "매도 우세 (50점 이하)", c: T.down },
              ].map((r) => (
                <div key={r.g} style={{ display: "flex", alignItems: "center", gap: "0.65rem",
                  padding: "clamp(0.3rem,0.5vw,0.6rem) clamp(0.6rem,1.1vw,1rem)",
                  background: T.surface, border: `1px solid ${T.rule}`, borderRadius: 3 }}>
                  <span style={{ fontWeight: 800, color: r.c, fontSize: "clamp(1.05rem,1.9vw,1.55rem)", width: "1.4em" }}>{r.g}</span>
                  <span style={{ fontSize: "clamp(0.9rem,1.7vw,1.2rem)", color: T.inkSec }}>{r.l}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />
    ),
  },

  /* 2. 알고리즘 시그널 */
  {
    label: "② 알고리즘 시그널",
    title: "알고리즘 시그널 — 종합 점수의 20%",
    subtitle: "기사 공개 시점·전일 데이터만으로 계산한 진입 조건 점수",
    content: (
      <TwoCol
        mock={
          <SbWrap>
            <p style={{ fontSize: "clamp(0.82rem,1.35vw,1.15rem)", fontWeight: 700, color: T.ink, margin: "0 0 0.55rem", letterSpacing: "0.04em" }}>
              퀀트 인사이트
            </p>
            {/* 종합 점수 카드 — 알고리즘 20% 반영 강조 */}
            <div style={{ background: T.canvas, borderRadius: 3, padding: "clamp(0.6rem,1.1vw,1.1rem)", marginBottom: "0.5rem" }}>
              <SbLabel>종합 점수(퀀트+알고리즘)</SbLabel>
              <div style={{ display: "flex", gap: "0.45rem", marginBottom: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: T.inkTer,
                  padding: "0.15rem 0.45rem", borderRadius: 3, fontWeight: 600,
                  background: `color-mix(in srgb,${T.accent} 8%,transparent)` }}>퀀트 75점</span>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: T.inkTer }}>+</span>
                <span style={{ fontSize: "clamp(0.62rem,0.95vw,0.82rem)", color: "#2563eb", fontWeight: 700,
                  padding: "0.15rem 0.45rem", borderRadius: 3,
                  background: `color-mix(in srgb,#2563eb 12%,transparent)`,
                  border: `1px solid color-mix(in srgb,#2563eb 30%,transparent)` }}>알고리즘 68점 × 20%</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", margin: "0.2rem 0" }}>
                <span style={{ fontSize: "clamp(1.5rem,2.8vw,2.8rem)", fontWeight: 800, color: T.accent, lineHeight: 1 }}>74</span>
                <span style={{ fontSize: "clamp(0.8rem,1.3vw,1.1rem)", color: T.inkTer }}>점</span>
              </div>
              <SbBar pct={74} gradient="linear-gradient(90deg,#15803d80,#22c55e)" />
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.75rem,1.4vw,1.25rem)" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2.1vw,1.45rem)", color: T.inkSec, lineHeight: 1.65 }}>
              종합 점수의 <strong>20%를 담당</strong>하는 알고리즘 점수는 기사 공개 시점의
              조건 6가지를 채점합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.3rem,0.5vw,0.55rem)" }}>
              {[
                ["공개 시각", "최대 15점", "장 전 공개일수록 유리"],
                ["MA20 이격", "최대 20점", "이평 아래 깊을수록 높음"],
                ["전일 수익률", "최대 15점", "전일 하락폭 클수록 높음"],
                ["갭하락", "최대 15점", "당일 시가 < 전일 종가"],
                ["기준 체결 위치", "최대 25점", "공개 직후 첫 체결가 위치"],
                ["전략 보너스", "최대 10점", "S2·S4·S5 복합 조건 가산"],
              ].map(([k, pts, v]) => (
                <div key={k} style={{ display: "flex", gap: "0.6rem", padding: "clamp(0.28rem,0.5vw,0.55rem) 0",
                  borderBottom: `1px solid ${T.rule}`, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600, color: T.accent, fontSize: "clamp(0.88rem,1.5vw,1.2rem)", minWidth: "clamp(70px,9vw,120px)" }}>{k}</span>
                  <span style={{ fontWeight: 600, color: "#2563eb", fontSize: "clamp(0.78rem,1.3vw,1.0rem)", minWidth: "clamp(50px,6vw,80px)" }}>{pts}</span>
                  <span style={{ fontSize: "clamp(0.86rem,1.45vw,1.15rem)", color: T.inkSec }}>{v}</span>
                </div>
              ))}
            </div>
            <Bullet><strong>S2+S4+S5 복합</strong> 조건은 1,550건 백테스트 승률 ≥ 60%입니다.</Bullet>
            <Bullet>알고리즘 데이터가 없으면 퀀트 점수만으로 종합 점수를 구성합니다.</Bullet>
          </div>
        }
      />
    ),
  },

  /* 3. AI 해석 카드 */
  {
    label: "③ AI 해석 카드",
    title: "핵심 패턴 + AI 한 줄 정리",
    subtitle: "숫자를 자연어로 번역 — 패턴 레이블 · 요점 불릿 · 실전 한 줄 정리",
    content: (
      <TwoCol
        mock={
          <SbWrap>
            {/* AI 카드 목업 */}
            <div style={{ background: T.canvas, borderRadius: 3, padding: "clamp(0.65rem,1.1vw,1.1rem)", marginBottom: "0.4rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                {/* 헤더 */}
                <div style={{ marginBottom: "0.45rem" }}>
                  <span style={{ fontSize: "clamp(0.65rem,1.0vw,0.9rem)", fontWeight: 700, letterSpacing: "0.12em",
                    color: T.accent, textTransform: "uppercase" as const }}>핵심 패턴</span>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "clamp(0.9rem,1.6vw,1.35rem)", fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                    변동성 응축 후 눌림 구간
                  </p>
                </div>
                {/* 불릿 */}
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "clamp(0.78rem,1.3vw,1.05rem)", color: T.inkSec, lineHeight: 1.6 }}>
                  <li style={{ marginBottom: "0.25rem" }}>최근 주가가 좁은 범위에서 움직이고 있습니다.</li>
                  <li style={{ marginBottom: "0.25rem" }}>20일 평균가(7,508원) 아래에 위치해 있습니다.</li>
                  <li>거래량이 평균보다 낮아 아직 조용한 구간입니다.</li>
                </ul>
                {/* 한 줄 정리 */}
                <div style={{ marginTop: "0.65rem", background: `color-mix(in srgb,${T.accent} 8%,transparent)`,
                  borderRadius: 3, padding: "clamp(0.45rem,0.8vw,0.85rem) clamp(0.55rem,1vw,1rem)" }}>
                  <span style={{ fontSize: "clamp(0.65rem,1.0vw,0.9rem)", fontWeight: 700, letterSpacing: "0.1em",
                    color: T.accent, display: "block", marginBottom: "0.3rem" }}>한 줄 정리</span>
                  <p style={{ margin: 0, fontSize: "clamp(0.78rem,1.3vw,1.05rem)", color: T.inkSec, lineHeight: 1.6 }}>
                    임상 기대감이 살아있는 상황에서 20일 평균(7,508원) 아래에서 반등 흐름이므로,
                    평균선 위·아래를 오가는지가 다음 구간의 기준 · 볼린저 하단(7,130원) 부근 반등·이탈 여부 · 약 8.2% 손절 폭을 전제로 분할·비중 조절로 해석할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.8rem,1.4vw,1.2rem)" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2.1vw,1.45rem)", color: T.inkSec, lineHeight: 1.65 }}>
              숫자만 보고는 해석이 어렵습니다. AI 카드는 지표 조합을 읽어
              <strong> 사람 말로 풀어쓴 3가지 레이어</strong>를 제공합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.55rem,1vw,0.9rem)" }}>
              {[
                { t: "핵심 패턴 레이블", d: "백테스팅에서 검증된 4가지 신호(변동성 응축·역발상·과매도반등·모멘텀경고) 중 해당하는 이름을 자동 부여합니다." },
                { t: "요점 불릿 2~3줄", d: "지표 현황을 투자자가 이해하기 쉬운 문장으로 풀어씁니다. 숫자 없이 상황만 요약합니다." },
                { t: "한 줄 정리 (Takeaway)", d: "MA20 가격·볼린저 하단가·손절 기준 %를 수치로 직접 언급하는 실전 한 줄 문장을 생성합니다. '뉴스를 함께 보세요' 같은 메타 안내는 출력하지 않습니다." },
              ].map((r) => (
                <Card key={r.t} style={{ padding: "clamp(0.7rem,1.2vw,1.2rem) clamp(0.85rem,1.5vw,1.5rem)" }}>
                  <div style={{ fontWeight: 700, color: T.ink, marginBottom: "0.35rem", fontSize: "clamp(0.95rem,1.8vw,1.25rem)" }}>{r.t}</div>
                  <div style={{ fontSize: "clamp(0.88rem,1.55vw,1.1rem)", color: T.inkSec, lineHeight: 1.6 }}>{r.d}</div>
                </Card>
              ))}
            </div>
            <Bullet>Q-Trans 또는 규칙 기반 템플릿을 자동 선택합니다.</Bullet>
            <Bullet>Q-Trans는 크래프트 테크놀로지스의 금융 특화 언어 모델입니다.</Bullet>
          </div>
        }
      />
    ),
  },

  /* 4. 핵심 지표 */
  {
    label: "④ 핵심 지표",
    title: "핵심 지표 — 6개 팩터 수치",
    subtitle: "상세 분석 패널을 펼치면 나오는 첫 번째 섹션 — 컬러 코딩으로 즉시 판독",
    content: (
      <TwoCol
        mock={
          <SbWrap>
            <div style={{ background: T.canvas, borderRadius: 3, padding: "clamp(0.6rem,1.1vw,1.1rem)" }}>
              <SbLabel>핵심 지표 (5분봉→일봉, 발행 시각)</SbLabel>
              <SbRow label="ATR 비율 (w30)" value="5.8%" color={T.up} />
              <SbRow label="거래량 비율 (w25)" value="0.78×" color={T.up} />
              <SbRow label="MA5-20 이격 (w20)" value="−1.2%" color={T.up} />
              <SbRow label="10일 모멘텀 (w10)" value="−3.1%" color={T.up} />
              <SbRow label="BB %B (w10)" value="0.35" color={T.up} />
              <SbRow label="RSI 14 (w5)" value="44.2" />
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.75rem,1.4vw,1.25rem)" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2.1vw,1.45rem)", color: T.inkSec, lineHeight: 1.65 }}>
              총점을 구성하는 6개 지표의 <strong>실제 수치</strong>를 보여줍니다.
              임계값을 넘으면 초록(유리) / 빨강(주의) 색으로 즉시 구분됩니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.3rem,0.5vw,0.5rem)" }}>
              {[
                ["ATR 비율", "w30", "변동성 크기. 낮을수록(≤6.5%) 응축 → 초록"],
                ["거래량 비율", "w25", "20일 평균 대비. 낮을수록(<1.0×) 고요한 응축"],
                ["MA5-20 이격", "w20", "단기·중기 이격. 낮을수록(≤1.5%) 눌림 구간"],
                ["10일 모멘텀", "w10", "역발상. 음수 구간이 반등 씨앗 (< 0% → 초록)"],
                ["BB %B", "w10", "볼린저 밴드 내 위치. 하단(≤0.40) → 초록"],
                ["RSI 14", "w5", "과매도(<30) → 초록, 과매수(>70) → 빨강"],
              ].map(([name, weight, desc]) => (
                <div key={name} style={{ display: "flex", gap: "0.6rem", padding: "clamp(0.28rem,0.5vw,0.55rem) 0",
                  borderBottom: `1px solid ${T.rule}`, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, color: T.accent, fontSize: "clamp(0.82rem,1.35vw,1.1rem)", width: "2em", flexShrink: 0 }}>{weight}</span>
                  <span style={{ fontWeight: 600, color: T.ink, fontSize: "clamp(0.88rem,1.5vw,1.15rem)", width: "clamp(70px,8vw,115px)", flexShrink: 0 }}>{name}</span>
                  <span style={{ fontSize: "clamp(0.84rem,1.45vw,1.1rem)", color: T.inkSec, lineHeight: 1.45 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />
    ),
  },

  /* 5. 추세 필터 */
  {
    label: "⑤ 추세 필터",
    title: "가격 위치 + 눌림 반등 조합 감지",
    subtitle: "MA20 기준 위치와 10일 흐름 방향으로 '눌림 뒤 반등' 조건을 실시간 감지",
    content: (
      <TwoCol
        mock={
          <SbWrap>
            <div style={{ background: T.canvas, borderRadius: 3, padding: "clamp(0.6rem,1.1vw,1.1rem)", marginBottom: "0.4rem" }}>
              <SbLabel>가격 위치 (20일 평균 기준)</SbLabel>
              <SbRow label="평균보다" value="아래 ↓" color={T.up} />
              <SbRow label="최근 10일 흐름" value="하락 ↓" color={T.up} />
              {/* 눌림 반등 배너 */}
              <div style={{ marginTop: "0.55rem", fontSize: "clamp(0.7rem,1.1vw,0.95rem)", color: T.up, fontWeight: 600,
                padding: "clamp(0.28rem,0.5vw,0.55rem) clamp(0.45rem,0.8vw,0.8rem)",
                background: `color-mix(in srgb,${T.up} 8%,transparent)`,
                borderRadius: 3, lineHeight: 1.5 }}>
                눌림 뒤 반등을 노리기 좋은 조합으로 자주 쓰입니다 (과거 통계 참고)
              </div>
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.75rem,1.4vw,1.25rem)" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2.1vw,1.45rem)", color: T.inkSec, lineHeight: 1.65 }}>
              두 가지 조건으로 <strong>지금 종목이 어느 국면인지</strong>를 한눈에 표시합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.55rem,1vw,0.9rem)" }}>
              <Card style={{ borderLeft: `3px solid ${T.up}` }}>
                <div style={{ fontWeight: 700, color: T.up, marginBottom: "0.35rem", fontSize: "clamp(0.92rem,1.65vw,1.2rem)" }}>MA20 아래 + 10일 하락 동시 (역발상 최적)</div>
                <div style={{ fontSize: "clamp(0.88rem,1.55vw,1.1rem)", color: T.inkSec, lineHeight: 1.6 }}>
                  '눌림 뒤 반등' 배너가 초록으로 뜹니다. 역추세 진입 조건이 갖춰졌다는 신호입니다.
                </div>
              </Card>
              <Card style={{ borderLeft: `3px solid ${T.accent}` }}>
                <div style={{ fontWeight: 700, color: T.accent, marginBottom: "0.35rem", fontSize: "clamp(0.92rem,1.65vw,1.2rem)" }}>MA20 아래 + 10일 상승</div>
                <div style={{ fontSize: "clamp(0.88rem,1.55vw,1.1rem)", color: T.inkSec, lineHeight: 1.6 }}>
                  평균선 아래에서 반등 흐름. 평균선 위·아래를 오가는지가 다음 구간의 기준이 됩니다.
                </div>
              </Card>
              <Card style={{ borderLeft: `3px solid ${T.warn}` }}>
                <div style={{ fontWeight: 700, color: T.warn, marginBottom: "0.35rem", fontSize: "clamp(0.92rem,1.65vw,1.2rem)" }}>MA20 아래 + 횡보</div>
                <div style={{ fontSize: "clamp(0.88rem,1.55vw,1.1rem)", color: T.inkSec, lineHeight: 1.6 }}>
                  방향 미결. 평균가 대비 종가 위치가 갈림의 시작점입니다.
                </div>
              </Card>
              <Card style={{ borderLeft: `3px solid ${T.down}` }}>
                <div style={{ fontWeight: 700, color: T.down, marginBottom: "0.35rem", fontSize: "clamp(0.92rem,1.65vw,1.2rem)" }}>MA20 위 + 10일 상승</div>
                <div style={{ fontSize: "clamp(0.88rem,1.55vw,1.1rem)", color: T.inkSec, lineHeight: 1.6 }}>
                  추세 추종 구간. 퀀트 점수는 낮아지나 모멘텀 전략에서는 유효할 수 있습니다.
                </div>
              </Card>
            </div>
            <Bullet>배너 문구는 <strong>과거 통계 참고</strong>이며 투자 권유가 아닙니다.</Bullet>
            <Bullet>알고리즘 시그널 점수의 MA20 축과 직접 연계됩니다.</Bullet>
          </div>
        }
      />
    ),
  },

  /* 6. 펀더멘탈 */
  {
    label: "⑥ 펀더멘탈",
    title: "재무 건전성 스코어 + 세부 지표",
    subtitle: "4축 재무 팩터 → 0~100점 + 우량~위험 등급 / 손익계산서 요약 포함",
    content: (
      <TwoCol
        mockWidth="330px"
        mock={
          <SbWrap>
            <div style={{ background: T.canvas, borderRadius: 3, padding: "0.65rem 0.75rem", marginBottom: "0.4rem" }}>
              <SbLabel>펀더멘탈 점수</SbLabel>
              {/* 총점 + 등급 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0.2rem 0" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem" }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>78</span>
                  <span style={{ fontSize: "0.75rem", color: T.inkTer }}>/ 100</span>
                </div>
                <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.88rem" }}>양호</span>
              </div>
              <SbBar pct={78} gradient="linear-gradient(90deg,#22c55e80,#22c55e)" />
              {/* 축별 */}
              {[
                ["영업이익 방향성 (35%)", 80],
                ["매출 성장 (25%)", 75],
                ["재무 건전성 (25%)", 70],
                ["수익성 품질 (15%)", 85],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "0.22rem 0", borderBottom: `1px solid ${T.rule}` }}>
                  <span style={{ fontSize: "0.7rem", color: T.inkSec }}>{k}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: T.ink }}>{v}</span>
                </div>
              ))}
            </div>
            {/* 기업 정보 */}
            <div style={{ padding: "0 0 0.2rem" }}>
              <p style={{ margin: "0.3rem 0 0.1rem", fontSize: "0.78rem", fontWeight: 700, color: T.ink }}>셀트리온</p>
              <p style={{ margin: 0, fontSize: "0.68rem", color: T.inkTer }}>코드 068270 · 바이오테크</p>
              <SbRow label="시가총액(참고)" value="약 24조 원" />
              <SbRow label="PER (TTM)" value="38.2" />
              <SbRow label="ROE(참고)" value="12.4%" />
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2vw,1.1rem)", color: T.inkSec, lineHeight: 1.65 }}>
              기술적 지표와 별개로, 해당 기업의 <strong>재무 체력</strong>을 4가지 관점에서 점수화합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {[
                ["w35", "영업이익 방향", "흑자 여부·YoY 개선 방향, 바이오 임상 단계 적자 허용"],
                ["w25", "매출 성장", "연/분기 YoY 성장률 및 추세 지속성"],
                ["w25", "재무 건전성", "유동비율·현금·부채비율"],
                ["w15", "수익성 품질", "영업이익률·Gross Margin·마진 추세"],
              ].map(([w, n, d]) => (
                <div key={n} style={{ display: "flex", gap: "0.55rem", padding: "0.35rem 0",
                  borderBottom: `1px solid ${T.rule}`, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, color: T.accent, fontSize: "0.82rem", width: 30, flexShrink: 0 }}>{w}</span>
                  <span style={{ fontWeight: 600, color: T.ink, fontSize: "0.88rem", width: 80, flexShrink: 0 }}>{n}</span>
                  <span style={{ fontSize: "0.85rem", color: T.inkSec, lineHeight: 1.4 }}>{d}</span>
                </div>
              ))}
            </div>
            <Bullet>등급: <strong style={{ color: T.up }}>우량·양호</strong> / <span style={{ color: T.warn }}>보통</span> / <span style={{ color: T.down }}>주의·위험</span></Bullet>
            <Bullet>PER·PBR·ROE·부채비율 등 개별 수치도 함께 표시됩니다.</Bullet>
          </div>
        }
      />
    ),
  },

  /* 7. 수익률 곡선 */
  {
    label: "⑦ 수익률 곡선",
    title: "발행 전후 누적 수익률 곡선",
    subtitle: "기사 공개 시점(T0) 기준 전후 ±거래일 · 5분봉 기반 누적 수익률 시각화",
    content: (
      <TwoCol
        mockWidth="340px"
        mock={
          <SbWrap>
            <SbLabel>발행 전후 누적 수익률</SbLabel>
            {/* 미니 차트 목업 */}
            <div style={{ background: T.canvas, borderRadius: 3, padding: "0.65rem 0.75rem", marginBottom: "0.4rem" }}>
              <div style={{ position: "relative", height: 80 }}>
                <svg width="100%" height="80" viewBox="0 0 280 80" preserveAspectRatio="none">
                  {/* 배경 세션 블록 */}
                  <rect x="96" y="0" width="56" height="80" fill="rgba(28,77,72,0.05)" />
                  <rect x="168" y="0" width="56" height="80" fill="rgba(28,77,72,0.05)" />
                  {/* T0 기준선 */}
                  <line x1="140" y1="0" x2="140" y2="80" stroke="#2563eb" strokeWidth="1" strokeDasharray="3,2" />
                  {/* 곡선 (조용히 오르는 형태) */}
                  <polyline fill="none" stroke={T.accent} strokeWidth="1.8"
                    points="0,55 40,52 80,58 96,62 110,56 120,48 130,44 140,42 155,36 168,32 185,28 200,24 220,20 250,22 280,18" />
                  {/* 0% 기준선 */}
                  <line x1="0" y1="60" x2="280" y2="60" stroke={T.rule} strokeWidth="1" />
                  {/* 레이블 */}
                  <text x="2" y="76" fontSize="7" fill={T.inkTer}>−3일</text>
                  <text x="136" y="76" fontSize="7" fill="#2563eb">T0</text>
                  <text x="265" y="76" fontSize="7" fill={T.inkTer}>+4일</text>
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem" }}>
                <span style={{ fontSize: "0.68rem", color: T.inkTer }}>068270 · 셀트리온</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.up }}>+4.2%</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.65rem", color: T.inkTer, lineHeight: 1.45 }}>
              파란 점선 = 기사 발행 시각 (T0) · 음영 = 장중 세션
            </p>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2vw,1.1rem)", color: T.inkSec, lineHeight: 1.65 }}>
              기사가 시장에 공개된 순간(T0)을 기준으로, <strong>전후 가격 흐름</strong>을 5분봉 곡선으로 보여줍니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { k: "X축 (시간)", v: "T0 = 0, 왼쪽 −3거래일 · 오른쪽 +4거래일" },
                { k: "Y축 (수익)", v: "기사 공개 직후 첫 체결 종가 기준 누적 수익률 (%)" },
                { k: "파란 점선", v: "기사 발행 시각 기준선 (시장이 이 순간에 정보를 받음)" },
                { k: "음영 세로줄", v: "장중 세션 블록 (09:00~15:25)" },
              ].map((r) => (
                <div key={r.k} style={{ display: "flex", gap: "0.6rem", padding: "0.35rem 0",
                  borderBottom: `1px solid ${T.rule}`, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600, color: T.ink, fontSize: "0.88rem", width: 100, flexShrink: 0 }}>{r.k}</span>
                  <span style={{ fontSize: "0.88rem", color: T.inkSec, lineHeight: 1.4 }}>{r.v}</span>
                </div>
              ))}
            </div>
            <Bullet>여러 종목이 연결된 기사는 <strong>종목별 곡선을 오버레이</strong>해 비교합니다.</Bullet>
            <Bullet>분석에서 <strong>유료 기사는 공개 직후 수익률 우위</strong>가 확인되어 이를 개별 기사 단위에서 검증할 수 있습니다.</Bullet>
          </div>
        }
      />
    ),
  },

  /* 8. SUMMARY */
  {
    label: "SUMMARY",
    title: "7가지 인사이트, 기사 한 페이지에",
    subtitle: "데이터 파이프라인 → 점수화 → AI 해석 → 시각화까지 원클릭",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.5rem,3.5vw,2.25rem)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1px",
          background: T.rule, border: `1px solid ${T.rule}`, borderRadius: 2, overflow: "hidden" }}>
          {[
            { n: "①", k: "종합 점수", d: "퀀트 기술 6지표(80%) + 알고리즘 시그널 6피처(20%) → 0~100점 합산 + A/B/C/D 등급" },
            { n: "②", k: "알고리즘 시그널", d: "공개 시각·이평 이격·갭·기준 체결가 6축 → 0~100. 종합 점수의 20%를 담당" },
            { n: "③", k: "AI 해석 카드", d: "패턴 레이블 + 2~3줄 불릿 + MA20·밴드하단·손절 % 수치 포함 한 줄 정리" },
            { n: "④", k: "핵심 지표", d: "6개 팩터 수치 + 임계값 컬러 코딩 (실시간 조건 판독)" },
            { n: "⑤", k: "추세 필터", d: "MA20 위·아래 + 4가지 국면(하락·상승·횡보·추세추종) 감지" },
            { n: "⑥", k: "펀더멘탈", d: "4축 재무 건전성 0~100 + 우량~위험 등급" },
            { n: "⑦", k: "수익률 곡선", d: "기사 공개 전후 5분봉 누적 수익률 · 종목별 오버레이 차트" },
          ].map((it) => (
            <div key={it.n} style={{ background: T.surface, padding: "clamp(1.1rem,2.5vw,1.5rem)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, color: T.accent, lineHeight: 1 }}>{it.n}</span>
                <span style={{ fontSize: "clamp(0.95rem,1.8vw,1.1rem)", fontWeight: 700, color: T.ink }}>{it.k}</span>
              </div>
              <p style={{ margin: 0, fontSize: "clamp(0.88rem,1.65vw,0.98rem)", color: T.inkSec, lineHeight: 1.55 }}>{it.d}</p>
            </div>
          ))}
        </div>
        <blockquote style={{
          margin: 0, padding: "1.1rem 0 0",
          borderTop: `2px solid ${T.accent}`,
          fontSize: "clamp(1.1rem,2.5vw,1.4rem)", fontWeight: 500,
          color: T.inkSec, fontStyle: "normal", letterSpacing: "-0.02em", lineHeight: 1.55,
          display: "flex", gap: "0.85rem", alignItems: "flex-start",
        }}>
          <span style={{ color: T.accent, flexShrink: 0, marginTop: 4 }}>
            <svg {...SVG} width={26} height={26}>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <circle cx="12" cy="17" r="0.5"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </span>
          <span>
            뉴스 기사를 읽는 순간, 투자자는 <strong>7가지 정량 렌즈</strong>로 종목을 즉시 평가할 수 있습니다.
            직관이 아니라 <strong>데이터로 판단</strong>하는 경험을 제공합니다.
          </span>
        </blockquote>
      </div>
    ),
  },
];

/* ── 슬라이드 엔진 ──────────────────────────────────────────────── */
function requestFS(el: HTMLElement) {
  const a = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  return el.requestFullscreen ? el.requestFullscreen() : a.webkitRequestFullscreen?.();
}
function exitFS() {
  const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  return document.exitFullscreen ? document.exitFullscreen() : d.webkitExitFullscreen?.();
}
function getFS(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export default function QuantInsightPresentationPage() {
  const [cur, setCur] = useState(0);
  const [fs, setFs] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const sync = () => setFs(!!getFS());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  const toggleFS = useCallback(async () => {
    if (!shellRef.current) return;
    try {
      if (!getFS()) await requestFS(shellRef.current);
      else await exitFS();
    } catch { /* noop */ }
  }, []);

  const next = useCallback(() => setCur((p) => Math.min(p + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setCur((p) => Math.max(p - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") next();
      if (e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
      if ((e.key === "f" || e.key === "F") && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleFS(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, toggleFS]);

  const slide = SLIDES[cur]!;
  const progress = ((cur + 1) / SLIDES.length) * 100;
  const inset = fs ? 0 : 12;

  const btnBase = (dis: boolean, primary?: boolean) => ({
    padding: "0.55rem 1.1rem", borderRadius: 2,
    border: `1px solid ${dis ? T.rule : T.ruleStrong}`,
    backgroundColor: primary && !dis ? T.ink : "transparent",
    color: primary && !dis ? T.surface : dis ? T.inkTer : T.ink,
    fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.01em",
    cursor: dis ? "not-allowed" as const : "pointer" as const,
    opacity: dis ? 0.45 : 1,
  });

  return (
    <div ref={shellRef} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      backgroundColor: T.shell, boxSizing: "border-box",
    }}>
      <header style={{
        flexShrink: 0, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        padding: "0.625rem clamp(1rem,3vw,1.5rem)", borderBottom: `1px solid ${T.shellHairline}`,
      }}>
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", justifySelf: "start" }}>
          <Link href="/" style={{ fontSize: "0.875rem", fontWeight: 500, color: T.chromeFgMuted, textDecoration: "none" }}>홈</Link>
          <Link href="/presentation" style={{ fontSize: "0.875rem", fontWeight: 500, color: T.chromeFgMuted, textDecoration: "none" }}>엔진 덱</Link>
          <Link href="/presentation/quant-indicator-pm" style={{ fontSize: "0.875rem", fontWeight: 500, color: T.chromeFgMuted, textDecoration: "none" }}>
            기획자용 덱
          </Link>
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.2em", color: T.chromeFgMuted,
          textTransform: "uppercase", textAlign: "center", whiteSpace: "nowrap" }}>
          FAM · 퀀트 인사이트
        </span>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "flex-end", justifySelf: "end" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: T.chromeFgMuted, fontFeatureSettings: '"tnum"' }}>
            {String(cur + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </span>
          <button type="button" onClick={toggleFS} aria-pressed={fs} title="전체화면 (F)" style={{
            padding: "0.45rem 0.95rem", fontSize: "0.8125rem", fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
            color: T.shell, backgroundColor: T.chromeFg, border: "none", borderRadius: 2, cursor: "pointer",
          }}>
            {fs ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </header>

      <div style={{
        flex: 1, minHeight: 0, margin: inset, borderRadius: fs ? 0 : 3,
        backgroundColor: T.canvas, display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: fs ? "none" : "0 32px 64px -24px rgba(0,0,0,0.55)",
      }}>
        <div style={{ height: 1, backgroundColor: T.rule, flexShrink: 0, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: 1, width: `${progress}%`,
            backgroundColor: T.accent, transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto",
          padding: "clamp(1.75rem,5.5vw,3.25rem)", display: "flex", flexDirection: "column" }}>
          <header style={{ marginBottom: "clamp(1.25rem,3.5vw,2rem)" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.16em",
              color: T.inkTer, marginBottom: "0.6rem" }}>
              {slide.label}
            </div>
            <h1 style={{ fontSize: "clamp(1.9rem,5vw,2.8rem)", fontWeight: 600, color: T.ink,
              margin: "0 0 0.5rem", lineHeight: 1.18, letterSpacing: "-0.03em", maxWidth: "52rem" }}>
              {slide.title}
            </h1>
            <p style={{ fontSize: "clamp(1.05rem,2.2vw,1.35rem)", color: T.inkTer, margin: 0,
              fontWeight: 400, letterSpacing: "-0.01em", maxWidth: "48rem", lineHeight: 1.55 }}>
              {slide.subtitle}
            </p>
          </header>
          <div style={{ flex: 1, minHeight: 0 }}>{slide.content}</div>
        </div>

        <footer style={{
          flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: "1rem", padding: "1rem clamp(1.35rem,4vw,2.25rem)",
          borderTop: `1px solid ${T.rule}`, backgroundColor: T.surface,
        }}>
          <button type="button" onClick={prev} disabled={cur === 0} style={btnBase(cur === 0)}>이전</button>
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            {SLIDES.map((_, i) => (
              <button key={i} type="button" aria-label={`슬라이드 ${i + 1}`}
                aria-current={cur === i ? "step" : undefined}
                onClick={() => setCur(i)}
                style={{
                  width: cur === i ? 28 : 6, height: 4, borderRadius: 1, border: "none", padding: 0,
                  cursor: "pointer", backgroundColor: cur === i ? T.accent : T.ruleStrong,
                  transition: "width 0.2s ease, background-color 0.2s ease",
                }}
              />
            ))}
          </div>
          <button type="button" onClick={next} disabled={cur === SLIDES.length - 1} style={btnBase(cur === SLIDES.length - 1, true)}>
            {cur === SLIDES.length - 1 ? "완료" : "다음"}
          </button>
        </footer>
      </div>

      <p style={{
        flexShrink: 0, margin: 0, padding: "0.4rem clamp(1rem,3vw,1.5rem) 0.55rem",
        fontSize: "0.8125rem", letterSpacing: "0.04em", color: T.chromeFgMuted,
        textAlign: "center", fontWeight: 500,
      }}>
        ← → · SPACE · PgUp / PgDn · F fullscreen · Esc
      </p>
    </div>
  );
}
