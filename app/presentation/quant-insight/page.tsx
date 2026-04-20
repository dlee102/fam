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
    title: "팜이데일리 x 크래프트 테크놀로지스",
    subtitle: "뉴스기사에 따른 퀀트인사이트",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.5rem,4vw,2.5rem)" }}>
        <p style={{ fontSize: "clamp(1.15rem,2.7vw,1.5rem)", color: T.inkSec, lineHeight: 1.65, maxWidth: "50rem", margin: 0 }}>
          종목 뉴스 기사 한 페이지에서 <strong>종합 점수(퀀트+알고리즘) · 핵심 지표 · 펀더멘탈 · 누적 수익률 곡선 · AI 해석</strong>까지,
          투자 판단에 필요한 맥락을 즉시 확인합니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem" }}>
          {[
            { n: "①", k: "종합 점수", d: "퀀트 기술(80%) + 알고리즘(20%) 합산 · A~D 등급" },
            { n: "②", k: "알고리즘 시그널", d: "공개 시각·이평·갭·체결 6피처 규칙 → 종합의 20%" },
            { n: "③", k: "학습 · 퀀트스코어 검증", d: "과거 사건 기준 검증 요약" },
            { n: "④", k: "핵심 지표", d: "ATR · 거래량 · 스파이크 · 갭 · MA · 모멘텀" },
            { n: "⑤", k: "펀더멘탈", d: "5축 바이오 재무 건전성 등급 (캐시 런웨이 포함)" },
            { n: "⑥", k: "수익률 곡선", d: "발행 전후 5분봉 누적" },
            { n: "⑦", k: "AI 해석 카드", d: "퀀트스코어(ML) + 차트·가격 기반 한 줄 정리" },
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
            <span style={{ fontSize: "clamp(1.35rem,3.2vw,2.35rem)", fontWeight: 800, color: T.ink, display: "block",
              letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "clamp(0.45rem,0.9vw,0.65rem)" }}>
              셀트리온
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
                  ATR·거래량·스파이크·MA이격·모멘텀·갭·BB 7개 바이오 소형주 특화 지표 가중합. RSI는 노이즈로 제거.
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
                { g: "A", l: "강한 매수 (78점 이상)", c: T.up },
                { g: "B", l: "매수 우세 (62~77점)", c: T.up },
                { g: "C", l: "중립 (45~61점)", c: T.warn },
                { g: "D", l: "매도 우세 (44점 이하)", c: T.down },
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
    subtitle: "기사 공개 시점·전일 데이터만으로 계산한 6피처 규칙 채점",
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
          </div>
        }
      />
    ),
  },

  /* 3. 학습 · 퀀트스코어 검증 */
  {
    label: "③ 학습 · 퀀트스코어 검증",
    title: "학습 · 퀀트스코어 검증",
    subtitle: "뉴스–종목 사건을 기준으로 한 과거 검증 요약",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1rem,2.2vw,1.75rem)", maxWidth: "56rem" }}>
        <p style={{ margin: 0, fontSize: "clamp(1rem,2vw,1.35rem)", color: T.inkSec, lineHeight: 1.7 }}>
          한 뉴스에 붙은 종목이 <strong>이후 짧은 구간에서 상승 쪽으로 이어졌는지</strong>를 과거 데이터로 점검한 <strong>요약 표</strong>입니다.
          화면에 표시되는 알고리즘 점수(6가지 규칙)와는 <strong>목적이 다릅니다</strong> — 점수가 아니라, 같은 사건 단위로
          “방법이 데이터 위에서 의미 있게 동작했는지”를 투명히 보여 드리기 위한 자료입니다. 투자 판단은 <strong>참고용</strong>이며
          미래 수익을 약속하지 않습니다.
        </p>

        <Card style={{ padding: "clamp(1rem,2vw,1.35rem)" }}>
          <div style={{ fontSize: "clamp(0.72rem,1.1vw,0.85rem)", fontWeight: 600, letterSpacing: "0.14em", color: T.inkTer,
            textTransform: "uppercase" as const, marginBottom: "0.65rem" }}>검증 범위</div>
          <ul style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "clamp(0.88rem,1.5vw,1.05rem)", color: T.inkSec, lineHeight: 1.65 }}>
            <li style={{ marginBottom: "0.4rem" }}>뉴스–종목 조합 <strong>861건</strong>을 사용했습니다. 이 중 약 7할은 과거 구간, 약 3할은 그보다 <strong>뒤의 기간</strong>만으로 성능을 확인해, “이미 본 미래”가 섞이지 않게 했습니다.</li>
            <li style={{ marginBottom: "0.4rem" }}>각 사건마다 “그 뒤 짧은 구간이 플러스였는지”를 기준으로 정리했습니다. 시기에 따라 긍정 비율은 달라질 수 있습니다.</li>
            <li>위 기준은 화면의 6가지 항목과 <strong>같은 이름·같은 점수가 아닙니다</strong>. 검증용 지표입니다.</li>
          </ul>
        </Card>

        <Card style={{ padding: "clamp(1rem,2vw,1.35rem)" }}>
          <div style={{ fontSize: "clamp(0.72rem,1.1vw,0.85rem)", fontWeight: 600, letterSpacing: "0.14em", color: T.inkTer,
            textTransform: "uppercase" as const, marginBottom: "0.65rem" }}>함께 본 정보(13가지 요약)</div>
          <p style={{ margin: 0, fontSize: "clamp(0.88rem,1.5vw,1.05rem)", color: T.inkSec, lineHeight: 1.65 }}>
            가격 위치(진입·전일 대비, 갭, 전일 등락), 이동평균 이격, RSI·모멘텀, 거래량 규모·급증 여부,
            <strong> 공개 시각·요일</strong>, 뉴스에서 읽히는 <strong>촉매 방향</strong> 등을 한꺼번에 반영한 조합입니다.
            통계적으로 의미 있게 보인 항목만 남긴 <strong>13가지</strong>로 압축했습니다.
          </p>
        </Card>

        <Card style={{ padding: "clamp(1rem,2vw,1.35rem)" }}>
          <div style={{ fontSize: "clamp(0.72rem,1.1vw,0.85rem)", fontWeight: 600, letterSpacing: "0.14em", color: T.inkTer,
            textTransform: "uppercase" as const, marginBottom: "0.65rem" }}>퀀트스코어 성능 요약(뒤쪽 기간만)</div>
          <p style={{ margin: "0 0 0.75rem", fontSize: "clamp(0.88rem,1.5vw,1.05rem)", color: T.inkSec, lineHeight: 1.65 }}>
            해석이 쉬운 선형 모형과, 패턴을 더 잡는 트리형 모형 두 가지로 비교했습니다. 맞추기만 하는 것이 아니라
            <strong> 확률이 얼마나 그럴듯한지</strong>(Brier)도 함께 적어 두었습니다.
          </p>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "clamp(0.82rem,1.4vw,0.98rem)", color: T.inkSec }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.ruleStrong}`, textAlign: "left" as const }}>
                  <th style={{ padding: "0.45rem 0.5rem 0.5rem 0", fontWeight: 600, color: T.ink }}>모델</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 600, color: T.ink }}>Train AUC</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 600, color: T.ink }}>Test AUC</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 600, color: T.ink }}>Test 정확도</th>
                  <th style={{ padding: "0.45rem 0 0.5rem 0.5rem", fontWeight: 600, color: T.ink }}>Brier</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["로지스틱 회귀", "0.710", "0.685", "61.4%", "0.220"],
                  ["LightGBM", "0.996", "0.719", "63.3%", "0.219"],
                  ["무작위 (균등 확률·1만 회 평균)", "0.500", "0.500", "50.0%", "0.334"],
                ].map((row) => (
                  <tr key={row[0]} style={{ borderBottom: `1px solid ${T.rule}` }}>
                    <td style={{ padding: "0.4rem 0.5rem 0.4rem 0", color: T.ink }}>{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td key={j} style={{ padding: "0.4rem 0.5rem", fontVariantNumeric: "tabular-nums" as const }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "0.65rem 0 0", fontSize: "clamp(0.78rem,1.3vw,0.95rem)", color: T.inkTer, lineHeight: 1.55 }}>
            맨 아래 행은 테스트 각 행에 <strong>[0, 1] 균등분포 무작위 확률</strong>을 부여해 AUC·정확도·Brier를 구한 뒤,
            그 과정을 <strong>10,000회</strong> 반복한 산술평균입니다(seed 고정). Brier는 행마다 확률이 달라 <strong>약 0.33</strong> 근처(항상 0.5만 쓸 때의 0.25와 다름)입니다.
          </p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "clamp(0.82rem,1.35vw,0.98rem)", color: T.inkTer, lineHeight: 1.55 }}>
            트리형 모형은 과거 구간에 더 강하게 맞춰질 수 있어, 숫자 해석이 중요하면 선형 모형 쪽을 함께 보시는 것이 좋습니다.
          </p>
        </Card>
      </div>
    ),
  },

  /* 4. 핵심 지표 */
  {
    label: "④ 핵심 지표",
    title: "핵심 지표 — 7개 바이오 소형주 특화 팩터",
    subtitle: "상세 분석 패널을 펼치면 나오는 첫 번째 섹션 — 바이오 소형주에 맞춘 임계값·컬러 코딩",
    content: (
      <TwoCol
        mock={
          <SbWrap>
            <div style={{ background: T.canvas, borderRadius: 3, padding: "clamp(0.6rem,1.1vw,1.1rem)" }}>
              <SbLabel>핵심 지표 (5분봉→일봉, 바이오 소형주 특화)</SbLabel>
              <SbRow label="ATR 비율 (w20)" value="7.2%" color={T.up} />
              <SbRow label="거래량 비율 (w18)" value="1.45×" color={T.up} />
              <SbRow label="거래량 스파이크 (w15)" value="2.8×" color={T.up} />
              <SbRow label="MA5-20 이격 (w15)" value="−2.5%" color={T.up} />
              <SbRow label="10일 모멘텀 (w15)" value="−5.1%" color={T.up} />
              <SbRow label="갭 오픈 (w10)" value="−1.3%" color={T.up} />
              <SbRow label="BB %B (w7)" value="0.28" color={T.up} />
            </div>
          </SbWrap>
        }
        desc={
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.75rem,1.4vw,1.25rem)" }}>
            <p style={{ margin: 0, fontSize: "clamp(1rem,2.1vw,1.45rem)", color: T.inkSec, lineHeight: 1.65 }}>
              퀀트 기술 점수를 구성하는 <strong>바이오 소형주 특화 7개 지표</strong>의 실제 수치입니다.
              RSI(AUC 0.507)는 노이즈로 판단하여 제거하고, 거래량 스파이크·갭 오픈을 추가했습니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.3rem,0.5vw,0.5rem)" }}>
              {[
                ["ATR 비율", "w20", "변동성 크기. 바이오 기준 ≤8%면 응축 → 초록"],
                ["거래량 비율", "w18", "20일 평균 대비. 바이오는 2×까지 정상, 5× 이상 경고"],
                ["거래량 스파이크", "w15", "5일 평균 대비. 카탈리스트 거래량 급증 포착"],
                ["MA5-20 이격", "w15", "단기·중기 이격. 바이오 기준 ≤6%면 정상"],
                ["10일 모멘텀", "w15", "역발상. 음수 구간이 반등 씨앗 (< -3% → 초록)"],
                ["갭 오픈", "w10", "장전 뉴스·공시 반영. 갭다운은 눌림 기회, 갭업은 추격 주의"],
                ["BB %B", "w7", "볼린저 밴드 내 위치. 극하단(≤0.10) → 초록"],
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

  /* 5. 펀더멘탈 */
  {
    label: "⑤ 펀더멘탈",
    title: "재무 건전성 스코어 + 세부 지표",
    subtitle: "5축 바이오 재무 팩터 → 0~100점 + 우량~위험 등급 / 캐시 런웨이 포함",
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
              <p style={{ margin: "0.3rem 0 0.15rem", fontSize: "clamp(1.15rem,2.4vw,1.65rem)", fontWeight: 800, color: T.ink,
                letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                셀트리온
              </p>
              <p style={{ margin: 0, fontSize: "clamp(0.78rem,1.35vw,0.95rem)", color: T.inkTer }}>바이오테크</p>
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

  /* 6. 수익률 곡선 */
  {
    label: "⑥ 수익률 곡선",
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "0.35rem", gap: "0.5rem" }}>
                <span style={{ fontSize: "clamp(0.95rem,1.85vw,1.35rem)", fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>
                  셀트리온
                </span>
                <span style={{ fontSize: "clamp(0.8rem,1.4vw,1.05rem)", fontWeight: 700, color: T.up }}>+4.2%</span>
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

  /* 7. AI 해석 카드 */
  {
    label: "⑦ AI 해석 카드",
    title: "퀀트스코어 + AI 한 줄 정리",
    subtitle: "ML 점수와 차트 숫자를 자연어로 — 요점 불릿 · 실전 한 줄 정리",
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
                    color: T.accent, textTransform: "uppercase" as const }}>퀀트 해석</span>
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
                { t: "차트 패턴 이름", d: "백테스팅에서 검증된 4가지 신호(변동성 응축·역발상·과매도반등·모멘텀경고) 중 해당하는 이름을 자동 부여합니다." },
                { t: "요점 불릿 2~3줄", d: "지표 현황을 투자자가 이해하기 쉬운 문장으로 풀어씁니다. 숫자 없이 상황만 요약합니다." },
                { t: "한 줄 정리 (Takeaway)", d: "퀀트스코어(0~99) 요약과 MA20·손절 % 등 수치를 한 문장에 담습니다. '뉴스를 함께 보세요' 같은 메타 안내는 출력하지 않습니다." },
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

  /* 7. SUMMARY */
  {
    label: "SUMMARY",
    title: "7가지 인사이트, 기사 한 페이지에",
    subtitle: "데이터 파이프라인 → 점수화 → 학습 검증 → AI 해석 → 시각화까지 원클릭",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.5rem,3.5vw,2.25rem)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1px",
          background: T.rule, border: `1px solid ${T.rule}`, borderRadius: 2, overflow: "hidden" }}>
          {[
            { n: "①", k: "종합 점수", d: "바이오 특화 7지표(80%) + 알고리즘 시그널 6피처(20%) → 30~100점 합산 + A/B/C/D 등급" },
            { n: "②", k: "알고리즘 시그널", d: "6축 규칙 0~100 · 종합 점수의 20% 담당" },
            { n: "③", k: "학습 · 퀀트스코어 검증", d: "뉴스–종목 861건 과거 요약 · 참고용 검증 지표" },
            { n: "④", k: "핵심 지표", d: "바이오 소형주 특화 7개 팩터 + 임계값 컬러 코딩" },
            { n: "⑤", k: "펀더멘탈", d: "5축 바이오 재무 건전성 0~100 (캐시 런웨이 포함) + 우량~위험 등급" },
            { n: "⑥", k: "수익률 곡선", d: "기사 공개 전후 5분봉 누적 수익률 · 종목별 오버레이 차트" },
            { n: "⑦", k: "AI 해석 카드", d: "퀀트스코어 + 차트 패턴 + 2~3줄 불릿 + MA20·손절 % 수치 포함 한 줄 정리" },
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
