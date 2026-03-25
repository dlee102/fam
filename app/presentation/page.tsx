"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useCallback, useEffect, useRef } from "react";

/** 미니멀 · 전문 발표 톤 (단일 악센트 + 뉴트럴) */
const theme = {
  shell: "#0a0a0b",
  shellHairline: "rgba(255,255,255,0.07)",
  chromeFg: "rgba(250,250,249,0.88)",
  chromeFgMuted: "rgba(250,250,249,0.42)",
  canvas: "#f7f6f4",
  surface: "#ffffff",
  ink: "#111111",
  inkSecondary: "#4a4a4a",
  inkTertiary: "#737373",
  accent: "#1c4d48",
  accentMuted: "rgba(28, 77, 72, 0.12)",
  rule: "rgba(0,0,0,0.06)",
  ruleStrong: "rgba(0,0,0,0.1)",
} as const;

const ICON_SZ = 26;
const svgBase = {
  width: ICON_SZ,
  height: ICON_SZ,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SlideIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: theme.accentMuted,
        color: theme.accent,
        marginBottom: "0.85rem",
      }}
    >
      {children}
    </span>
  );
}

function CardTopIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 9,
        backgroundColor: theme.accentMuted,
        color: theme.accent,
        marginBottom: "0.75rem",
      }}
    >
      {children}
    </span>
  );
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: theme.accentMuted,
        color: theme.accent,
        marginRight: "0.65rem",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function requestFullscreenEl(el: HTMLElement) {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (el.requestFullscreen) return el.requestFullscreen();
  if (anyEl.webkitRequestFullscreen) return Promise.resolve(anyEl.webkitRequestFullscreen());
  return Promise.reject(new Error("Fullscreen not supported"));
}

function exitFullscreenDoc() {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (document.exitFullscreen) return document.exitFullscreen();
  if (doc.webkitExitFullscreen) return Promise.resolve(doc.webkitExitFullscreen());
  return Promise.reject(new Error("Exit fullscreen not supported"));
}

function getFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

const SLIDES = [
  {
    title: "AI Intelligence: 데이터에서 알파까지",
    subtitle: "FAM 퀀트 엔진의 작동 원리와 핵심 메커니즘",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1.75rem, 4.5vw, 2.75rem)" }}>
        <p
          style={{
            fontSize: "clamp(1.2rem, 2.9vw, 1.55rem)",
            color: theme.inkSecondary,
            lineHeight: 1.65,
            maxWidth: "48rem",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          뉴스 기반의 비정형 정보가 어떻게 정량적 팩터로 치환되어 실질적인 투자 알파(Alpha)를 창출하는지,
          엔터프라이즈급 퀀트 파이프라인의 전 과정을 소개합니다.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "clamp(1rem, 2.2vw, 1.5rem)",
          }}
        >
          {[
            {
              step: "01",
              label: "Data Pipeline",
              desc: "미디어사 API 수신 및 유니버스 필터링",
              icon: (
                <svg {...svgBase}>
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                </svg>
              ),
            },
            {
              step: "02",
              label: "Factor Scoring",
              desc: "실제 체결·호가창·투자자 매매 흐름을 보고, 그날 시장 전체와 비교해 종목별 점수를 계산",
              icon: (
                <svg {...svgBase}>
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ),
            },
            {
              step: "03",
              label: "Alpha Engine",
              desc: "멀티-팩터 결합 및 이벤트 백테스트 검증",
              icon: (
                <svg {...svgBase}>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              ),
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                padding: "clamp(1.25rem, 2.8vw, 1.75rem)",
                backgroundColor: theme.surface,
                border: `1px solid ${theme.rule}`,
                borderRadius: 2,
                borderLeft: `3px solid ${theme.accent}`,
                boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
              }}
            >
              <SlideIcon>{item.icon}</SlideIcon>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  color: theme.accent,
                  marginBottom: "0.5rem",
                }}
              >
                {item.step}
              </div>
              <div
                style={{
                  fontSize: "clamp(1.15rem, 2.4vw, 1.45rem)",
                  fontWeight: 600,
                  color: theme.ink,
                  marginBottom: "0.5rem",
                  letterSpacing: "-0.02em",
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: "clamp(1.02rem, 2vw, 1.15rem)", color: theme.inkTertiary, lineHeight: 1.55 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Step 1: 데이터 파이프라인 및 전처리",
    subtitle: "Raw 데이터의 정제 및 유니버스 정의",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          <div style={{ padding: "clamp(1.35rem, 3vw, 1.85rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: theme.accent,
                margin: "0 0 1.1rem",
                letterSpacing: "0.1em",
                display: "flex",
                alignItems: "center",
              }}
            >
              <SectionIcon>
                <svg {...svgBase} width={22} height={22}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </SectionIcon>
              DATA INGESTION
            </h4>
            <ul style={{ margin: 0, paddingLeft: "1.35rem", fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary, lineHeight: 1.85 }}>
              <li><strong>Media API</strong>: 실시간 뉴스 및 메타데이터(기사 ID, 배포시각) 수집</li>
              <li><strong>Tick Data</strong>: 전 종목 초단위 체결(Trades) 및 호가(Books) parquet 연동</li>
              <li><strong>Supply/Demand</strong>: 일별 외국인/기관 순매수 데이터 적재</li>
            </ul>
          </div>
          <div style={{ padding: "clamp(1.35rem, 3vw, 1.85rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: theme.accent,
                margin: "0 0 1.1rem",
                letterSpacing: "0.1em",
                display: "flex",
                alignItems: "center",
              }}
            >
              <SectionIcon>
                <svg {...svgBase} width={22} height={22}>
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </SectionIcon>
              PRE-PROCESSING
            </h4>
            <ul style={{ margin: 0, paddingLeft: "1.35rem", fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary, lineHeight: 1.85 }}>
              <li><strong>Universe Filter</strong>: 시가총액·거래대금 하위 종목 및 관리종목 제외</li>
              <li><strong>Time Alignment</strong>: 뉴스 배포 시점 기준 T0 거래일 매칭</li>
              <li><strong>Cleaning</strong>: 이상치(Outlier) 제거 및 데이터 누락값 보간 처리</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Step 2: 기술적·수급 팩터 엔지니어링",
    subtitle: "가격 거동과 호가 구조에서 추출하는 독립 변수",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div
          style={{
            padding: "clamp(1.35rem, 3.2vw, 2rem)",
            backgroundColor: theme.surface,
            border: `1px solid ${theme.rule}`,
            borderRadius: 2,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2.25rem" }}>
            <div>
              <h3
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: theme.inkTertiary,
                  marginBottom: "1.1rem",
                  letterSpacing: "0.1em",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <SectionIcon>
                  <svg {...svgBase} width={22} height={22}>
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </SectionIcon>
                PRICE & VOL MOMENTUM
              </h3>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8, fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary }}>
                <li style={{ marginBottom: "0.65rem" }}>
                  <strong style={{ color: theme.ink }}>Momentum (30%)</strong>
                  <br />
                  일중 수익률 퍼센타일. 강세 종목의 관성 측정.
                </li>
                <li style={{ marginBottom: "0.65rem" }}>
                  <strong style={{ color: theme.ink }}>Trend Strength (30%)</strong>
                  <br />
                  고저폭 대비 종가 위치 기반 추세 건전성 평가.
                </li>
                <li>
                  <strong style={{ color: theme.ink }}>Volume Activity (20%)</strong>
                  <br />
                  횡단면 거래량 집중도 분석으로 신호 신뢰도 검증.
                </li>
              </ul>
            </div>
            <div>
              <h3
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: theme.inkTertiary,
                  marginBottom: "1.1rem",
                  letterSpacing: "0.1em",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <SectionIcon>
                  <svg {...svgBase} width={22} height={22}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </SectionIcon>
                MICROSTRUCTURE & FLOW
              </h3>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8, fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary }}>
                <li style={{ marginBottom: "0.65rem" }}>
                  <strong style={{ color: theme.ink }}>Liquidity Spread (20%)</strong>
                  <br />
                  호가 갭 기반 마찰 비용 측정. 좁을수록 높은 점수.
                </li>
                <li style={{ marginBottom: "0.65rem" }}>
                  <strong style={{ color: theme.ink }}>Orderbook Imbalance</strong>
                  <br />
                  매수/매도 호가 잔량 불균형 분석 (잠재 매수 압력).
                </li>
                <li>
                  <strong style={{ color: theme.ink }}>Foreign Net Flow</strong>
                  <br />
                  기관/외국인 수급의 일중 방향성 및 강도 추적.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Step 3: 정규화 및 섹터 중립화",
    subtitle: "횡단면에서 스케일을 맞추고, 업종·공통 요인 편향을 걷어내는 단계",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(1.05rem, 2vw, 1.18rem)",
            color: theme.inkSecondary,
            lineHeight: 1.65,
            maxWidth: "52rem",
          }}
        >
          원시 팩터는 단위·분포·꼬리(heavy tail)가 제각각입니다. <strong>같은 거래일(D)·같은 유니버스</strong> 안에서 먼저 극단값을 다루고, 순위·잔차로 바꿔야
          서로 다른 팩터를 한 프레임에서 비교·가중할 수 있습니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.35rem" }}>
          {[
            {
              t: "Winsorization / Trimming",
              d: "극단 관측치가 평균·분산·상관을 끌고 가는 것을 막는 전처리입니다. 하드 클리핑 대신 상·하위 백분위 밖을 잘라 붙이는 방식이 흔합니다.",
              bullets: [
                "예: 상·하위 1~2.5%를 각각 P97.5, P2.5 값으로 대체",
                "팩터별로 민감도가 다르면 임계 백분위·로그 변환을 병행",
                "유동성·시총 하위 종목은 꼬리가 두꺼워 별도 규칙을 두기도 함",
              ],
              icon: (
                <svg {...svgBase} width={22} height={22}>
                  <path d="M4 12h16" />
                  <path d="M8 8v8M16 8v8" />
                  <path d="M6 4h12v16H6z" strokeDasharray="2 2" />
                </svg>
              ),
            },
            {
              t: "Cross-sectional Rank & Scale",
              d: "당일 전 종목에 대해 팩터 값을 정렬해 퍼센타일 랭크(0~100)나 Z-score로 맞춥니다. ‘88점’은 그날 시장에서의 상대 위치에 가깝습니다.",
              bullets: [
                "랭크는 단조 변환(monotonic)이라 해석이 직관적이고 강건한 편",
                "Z-score는 섹터·시총 회귀 잔차(residual)로 바꾸면 ‘순수’ 노출에 가까워짐",
                "동일 팩터라도 리밸런싱 주기마다 횡단면을 다시 계산하는 것이 일반적",
              ],
              icon: (
                <svg {...svgBase} width={22} height={22}>
                  <line x1="10" y1="6" x2="21" y2="6" />
                  <line x1="10" y1="12" x2="21" y2="12" />
                  <line x1="10" y1="18" x2="21" y2="18" />
                  <circle cx="5" cy="6" r="2" />
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="5" cy="18" r="2" />
                </svg>
              ),
            },
            {
              t: "Neutralization (Sector · Style)",
              d: "산업·시가총액·베타 등 ‘공통 요인’에 대한 노출을 줄여, 특정 업종 강세만 따라가는 가짜 신호를 걸러냅니다.",
              bullets: [
                "섹터 더미 또는 GICS/KSIC 기준 그룹 평균을 빼는 방식",
                "Barra류: 시총·베타·모멘텀 등 스타일 팩터에 대한 회귀 잔차",
                "이 단계 이후 남는 것이 ‘상대 초과’에 가까운 포지션 스코어로 해석",
              ],
              icon: (
                <svg {...svgBase} width={22} height={22}>
                  <line x1="12" y1="3" x2="12" y2="21" />
                  <path d="M5 21h14" />
                  <path d="M7 21c0-2 2-3 5-3s5 1 5 3" />
                  <path d="M9 3h6v4H9z" />
                </svg>
              ),
            },
          ].map((item, i) => (
            <div key={i} style={{ padding: "clamp(1.2rem, 2.5vw, 1.55rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
              <CardTopIcon>{item.icon}</CardTopIcon>
              <div style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.1rem)", fontWeight: 700, color: theme.accent, marginBottom: "0.55rem" }}>{item.t}</div>
              <div style={{ fontSize: "clamp(1.02rem, 1.9vw, 1.12rem)", color: theme.inkSecondary, lineHeight: 1.6, marginBottom: "0.65rem" }}>{item.d}</div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.2rem",
                  fontSize: "clamp(0.98rem, 1.75vw, 1.06rem)",
                  color: theme.inkTertiary,
                  lineHeight: 1.55,
                }}
              >
                {item.bullets.map((b) => (
                  <li key={b} style={{ marginBottom: "0.35rem" }}>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
          <div style={{ padding: "clamp(1.15rem, 2.4vw, 1.4rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.12em", color: theme.inkTertiary, marginBottom: "0.65rem" }}>DATA HYGIENE</div>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "clamp(1.02rem, 1.9vw, 1.1rem)", color: theme.inkSecondary, lineHeight: 1.6 }}>
              <li style={{ marginBottom: "0.4rem" }}>결측·정지·동시호가: 스코어 제외 또는 섹터 중앙값 대체 등 명시적 규칙</li>
              <li style={{ marginBottom: "0.4rem" }}>ADR·스핀오프·상장 직후 구간은 유니버스에서 제외하는 경우가 많음</li>
              <li>동일 팩터의 과거 버전과 분포 드리프트 모니터링(PSI 등)</li>
            </ul>
          </div>
          <div style={{ padding: "clamp(1.15rem, 2.4vw, 1.4rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.12em", color: theme.inkTertiary, marginBottom: "0.65rem" }}>IMPLEMENTATION NOTE</div>
            <p style={{ margin: 0, fontSize: "clamp(1.02rem, 1.9vw, 1.1rem)", color: theme.inkSecondary, lineHeight: 1.6 }}>
              현재 일중 스코어 파이프라인(<code style={{ fontSize: "0.9em", color: theme.ink }}>quant.run</code>)은 <strong>횡단면 퍼센타일·스케일 변환</strong> 중심입니다.
              Winsorize·섹터/베타 잔차화는 운용 규모가 커지거나 벤치 대비 초과성과를 맞출 때 단계적으로 얹는 경우가 많습니다.
            </p>
          </div>
        </div>
        <div
          style={{
            padding: "clamp(1.2rem, 2.5vw, 1.45rem)",
            backgroundColor: theme.accentMuted,
            borderRadius: 2,
            fontSize: "clamp(1.05rem, 2vw, 1.15rem)",
            color: theme.inkSecondary,
            lineHeight: 1.65,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2, color: theme.accent }}>
            <svg {...svgBase} width={22} height={22}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <span>
            <strong>Note</strong>: 점수는 <strong>절대 수익이 아니라 그날 유니버스 안에서의 상대 강도</strong>입니다. 장세가 바뀌면 같은 종목이라도 퍼센타일이 달라지므로,
            리밸런싱 주기·유니버스 정의를 문서에 고정해 두는 것이 재현성에 중요합니다.
          </span>
        </div>
      </div>
    ),
  },
  {
    title: "Step 4: 멀티-팩터 결합 (Multi-Factor Scoring)",
    subtitle: "정규화된 팩터를 하나의 포지션 스코어로 압축하고, 운용 규칙에 맞게 이산화하는 단계",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(1.05rem, 2vw, 1.18rem)",
            color: theme.inkSecondary,
            lineHeight: 1.65,
            maxWidth: "52rem",
          }}
        >
          목표는 단일 스칼라 <strong>포지션 스코어</strong>를 만든 뒤, 유동성·베타·턴오버 제약 하에서 매수/보유/매도 또는 비중 상한으로 넘기는 것입니다.
          결합 전에 팩터 간 상관을 줄이고, 가중치는 <strong>검증 구간의 예측력(IC)·안정성(IC IR)·거래비용</strong>을 함께 보며 정합니다.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "clamp(1.35rem, 3vw, 2.25rem)",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              padding: "clamp(1.35rem, 3.2vw, 2rem)",
              backgroundColor: theme.accentMuted,
              border: `1px solid ${theme.rule}`,
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <span style={{ color: theme.accent, marginBottom: "0.65rem" }}>
              <svg {...svgBase} width={32} height={32}>
                <path d="M12 2l10 5-10 5L2 7l10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <div style={{ textAlign: "center", fontSize: "0.95rem", fontWeight: 600, letterSpacing: "0.16em", color: theme.accent, marginBottom: "0.85rem" }}>COMPOSITE SCORE</div>
            <div style={{ fontSize: "clamp(1.75rem, 5vw, 2.85rem)", fontWeight: 600, textAlign: "center", color: theme.ink, letterSpacing: "-0.03em" }}>
              Σ (w<sub style={{ fontSize: "0.65em", opacity: 0.75 }}>i</sub> · f<sub style={{ fontSize: "0.65em", opacity: 0.75 }}>i</sub>)
            </div>
            <div style={{ textAlign: "center", fontSize: "clamp(0.95rem, 1.75vw, 1.05rem)", color: theme.inkTertiary, marginTop: "0.85rem", lineHeight: 1.55, maxWidth: "22rem" }}>
              <em>f<sub>i</sub></em>: 이미 정규화된 팩터(랭크·Z·잔차). <em>w<sub>i</sub></em>: 합이 1이 되도록 제약하거나 L2·턴오버 페널티 하에서 최적화.
            </div>
            <div style={{ textAlign: "center", fontSize: "clamp(1rem, 1.9vw, 1.1rem)", color: theme.inkSecondary, marginTop: "1rem", lineHeight: 1.55, maxWidth: "24rem" }}>
              단순 합이 아니라 <strong>상관 완화</strong>(그람-슈미트, PCA 1차 성분 제거 등)를 거친 뒤 합산하는 구성도 흔합니다.
            </div>
          </div>
          <div style={{ fontSize: "clamp(1.05rem, 2vw, 1.2rem)", lineHeight: 1.7, color: theme.inkSecondary, alignSelf: "center" }}>
            <p style={{ margin: "0 0 1.1rem", display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
              <span style={{ color: theme.accent, flexShrink: 0, marginTop: 3 }}>
                <svg {...svgBase} width={22} height={22}>
                  <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />
                </svg>
              </span>
              <span>
                <strong>01 Orthogonalization</strong>
                <br />
                모멘텀·유동성처럼 서로 닮은 팩터는 한 축으로 흡수되기 쉽습니다. 한쪽을 다른쪽에 회귀한 <strong>잔차 팩터</strong>로 바꾸면 중복 알파를 줄일 수 있습니다.
              </span>
            </p>
            <p style={{ margin: "0 0 1.1rem", display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
              <span style={{ color: theme.accent, flexShrink: 0, marginTop: 3 }}>
                <svg {...svgBase} width={22} height={22}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
              </span>
              <span>
                <strong>02 Weight selection</strong>
                <br />
                롤링 윈도에서 <strong>IC(시그널·전방 수익 상관)</strong>, <strong>IC IR(IC÷표준편차)</strong>, 반감기, 포트 턴오버를 보고 가중을 정합니다. 과최적화를 막기 위해
                단순 균등·Bayesian shrinkage·최대 비중 캡을 병행합니다.
              </span>
            </p>
            <p style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
              <span style={{ color: theme.accent, flexShrink: 0, marginTop: 3 }}>
                <svg {...svgBase} width={22} height={22}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6v6H9z" />
                </svg>
              </span>
              <span>
                <strong>03 Discretization &amp; hysteresis</strong>
                <br />
                연속 스코어를 1~5 등급이나 Long/Flat/Short로 자를 때는 <strong>횡단면 분위수</strong> 컷을 쓰고, 경계에서 잦은 뒤집힘을 막기 위해
                <strong>히스테리시스</strong>(진입·청산 임계 분리)를 두는 것이 거래비용 관점에서 표준에 가깝습니다.
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
          <div style={{ padding: "clamp(1.15rem, 2.4vw, 1.45rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.12em", color: theme.inkTertiary, marginBottom: "0.65rem" }}>REPORT · API 연동</div>
            <p style={{ margin: "0 0 0.65rem", fontSize: "clamp(1.02rem, 1.9vw, 1.1rem)", color: theme.inkSecondary, lineHeight: 1.6 }}>
              종합 리포트의 기술 레이더는 <strong>모멘텀 30% · 추세 30% · 유동성(스프레드) 20% · 거래량 20%</strong> 등 <strong>고정 가중</strong>으로 단일 점수를 내는 UX에 가깝습니다.
            </p>
            <p style={{ margin: 0, fontSize: "clamp(1.02rem, 1.9vw, 1.1rem)", color: theme.inkSecondary, lineHeight: 1.6 }}>
              <code style={{ fontSize: "0.9em", color: theme.ink }}>/api/quant/scores</code>는 동일 일자의 <strong>호가 불균형·외국인 순매수</strong> 등 추가 스코어를 함께 반환하며, 레이더 4축 합산에는 아직 모두 올라가 있지 않을 수 있습니다.
              운용 단계에서 가중·팩터 집합을 맞추면 됩니다.
            </p>
          </div>
          <div style={{ padding: "clamp(1.15rem, 2.4vw, 1.45rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.12em", color: theme.inkTertiary, marginBottom: "0.65rem" }}>RISK · EXECUTION</div>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "clamp(1.02rem, 1.9vw, 1.1rem)", color: theme.inkSecondary, lineHeight: 1.6 }}>
              <li style={{ marginBottom: "0.4rem" }}>포지션 상한·섹터 캡·베타 타깃을 스코어와 동시에 제약으로 넣기</li>
              <li style={{ marginBottom: "0.4rem" }}>시그널 강도 × 유동성 스코어로 체결 가능 물량 추정</li>
              <li>백테스트·페이퍼에서 측정한 슬리피지·수수료를 가중 최적화에 반영</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Step 5: 백테스트 및 통계적 검증",
    subtitle: "과거 데이터 시뮬레이션을 통한 전략 유효성 확인",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          <div style={{ padding: "clamp(1.35rem, 3vw, 1.85rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: theme.accent,
                marginBottom: "1.1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
              }}
            >
              <span style={{ color: theme.accent, display: "flex" }}>
                <svg {...svgBase} width={24} height={24}>
                  <path d="M9 2h6l3 7H6l3-7z" />
                  <path d="M9 9v12M15 9v12M6 21h12" />
                </svg>
              </span>
              EVENT STUDY
            </h4>
            <div style={{ fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary, lineHeight: 1.65 }}>
              특정 뉴스 배포 시점(T0) 이후 <strong>T+1, T+3, T+5일</strong>의 가격 궤적 추적. 유사 기사 클러스터링을 통해 <strong>평균 기대 수익률</strong> 및 <strong>최적 보유 기간</strong> 산출.
            </div>
          </div>
          <div style={{ padding: "clamp(1.35rem, 3vw, 1.85rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: theme.accent,
                marginBottom: "1.1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
              }}
            >
              <span style={{ color: theme.accent, display: "flex" }}>
                <svg {...svgBase} width={24} height={24}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              ROBUSTNESS CHECK
            </h4>
            <ul style={{ margin: 0, paddingLeft: "1.35rem", fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary, lineHeight: 1.65 }}>
              <li><strong>Win Rate</strong>: 진입 시점별 매수 우위 확률(승률) 측정</li>
              <li><strong>Information Coefficient (IC)</strong>: 예측 시그널과 실제 수익률 간 상관계수</li>
              <li><strong>Decay Analysis</strong>: 시그널의 유효 시간(반감기) 분석</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Step 6: 리스크 가드레일 (Risk Guardrails)",
    subtitle: "안정적인 운용을 위한 리스크 관리 체계",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.35rem" }}>
          {[
            {
              t: "Liquidity Risk",
              d: "호가 스프레드가 넓거나 일일 거래대금이 부족한 종목 자동 필터링",
              icon: (
                <svg {...svgBase} width={22} height={22}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
            },
            {
              t: "Volatility Cap",
              d: "비정상적 변동성 확대 구간에서 시그널 강도 하향 조정",
              icon: (
                <svg {...svgBase} width={22} height={22}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              ),
            },
            {
              t: "Tail Risk Control",
              d: "펀더멘털 급변 및 상장폐지 위험 등 정성적 리스크 지표 결합",
              icon: (
                <svg {...svgBase} width={22} height={22}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ),
            },
          ].map((r, i) => (
            <div key={i} style={{ padding: "clamp(1.35rem, 2.8vw, 1.65rem)", backgroundColor: theme.surface, border: `1px solid ${theme.rule}`, borderRadius: 2 }}>
              <CardTopIcon>{r.icon}</CardTopIcon>
              <div style={{ fontSize: "clamp(1.1rem, 2.1vw, 1.3rem)", fontWeight: 600, color: theme.ink, marginBottom: "0.55rem" }}>{r.t}</div>
              <div style={{ fontSize: "clamp(1.02rem, 1.95vw, 1.12rem)", color: theme.inkSecondary, lineHeight: 1.6 }}>{r.d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Step 7: 전략적 활용 및 엔터프라이즈 통합",
    subtitle: "투자 의사결정 프로세스 최적화",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", backgroundColor: theme.rule, border: `1px solid ${theme.rule}`, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ padding: "clamp(1.4rem, 3vw, 1.75rem)", backgroundColor: theme.surface }}>
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                letterSpacing: "0.14em",
                color: theme.inkTertiary,
                margin: "0 0 0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
              }}
            >
              <span style={{ color: theme.accent, display: "flex" }}>
                <svg {...svgBase} width={22} height={22}>
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              DECISION SUPPORT
            </h4>
            <p style={{ fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary, margin: 0, lineHeight: 1.6 }}>
              팩터 노출도(Factor Exposure) 분석을 통한 <strong>스타일 틸팅</strong> 및 <strong>포트폴리오 비중 최적화</strong> 가이드 제공.
            </p>
          </div>
          <div style={{ padding: "clamp(1.4rem, 3vw, 1.75rem)", backgroundColor: theme.surface }}>
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                letterSpacing: "0.14em",
                color: theme.inkTertiary,
                margin: "0 0 0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
              }}
            >
              <span style={{ color: theme.accent, display: "flex" }}>
                <svg {...svgBase} width={22} height={22}>
                  <path d="M12 22v-5M9 8V2M15 8V2M5 12H2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
                  <path d="M19 12h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" />
                  <path d="M7 12h10" />
                </svg>
              </span>
              API-FIRST WORKFLOW
            </h4>
            <p style={{ fontSize: "clamp(1.05rem, 2vw, 1.2rem)", color: theme.inkSecondary, margin: 0, lineHeight: 1.6 }}>
              실시간 팩터 API를 통해 기존 OMS/EMS 시스템과 즉시 연동 가능하며, <strong>자동 매매 로직</strong>의 입력 변수로 활용.
            </p>
          </div>
        </div>
        <blockquote
          style={{
            margin: 0,
            padding: "1.15rem 0 0",
            borderTop: `1px solid ${theme.ruleStrong}`,
            fontSize: "clamp(1.15rem, 2.7vw, 1.45rem)",
            fontWeight: 500,
            color: theme.inkSecondary,
            fontStyle: "normal",
            letterSpacing: "-0.02em",
            lineHeight: 1.55,
            display: "flex",
            gap: "0.85rem",
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: theme.accent, flexShrink: 0, marginTop: 4 }}>
            <svg {...svgBase} width={26} height={26}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </span>
          <span>
            FAM 퀀트 엔진은 정성적 뉴스를 숫자로 바꾸는 것을 넘어, 자산 운용의 <strong>객관성과 재현성</strong>을 보장하는 핵심 인프라가 됩니다.
          </span>
        </blockquote>
      </div>
    ),
  },
];

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const sync = () => setIsBrowserFullscreen(!!getFullscreenElement());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!getFullscreenElement()) {
        await requestFullscreenEl(el);
      } else {
        await exitFullscreenDoc();
      }
    } catch {
      /* 정책·미지원 */
    }
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1 < SLIDES.length ? prev + 1 : prev));
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        if (e.key === " ") e.preventDefault();
        nextSlide();
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        prevSlide();
      }
      if (e.key === "f" || e.key === "F") {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          toggleBrowserFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextSlide, prevSlide, toggleBrowserFullscreen]);

  const slide = SLIDES[currentSlide];
  const inset = isBrowserFullscreen ? 0 : 12;
  const progress = ((currentSlide + 1) / SLIDES.length) * 100;

  const btnGhost = (disabled: boolean) => ({
    padding: "0.55rem 1.05rem",
    borderRadius: 2,
    border: `1px solid ${disabled ? theme.rule : theme.ruleStrong}`,
    backgroundColor: "transparent",
    color: disabled ? theme.inkTertiary : theme.ink,
    fontSize: "0.9375rem",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    cursor: disabled ? ("not-allowed" as const) : ("pointer" as const),
    opacity: disabled ? 0.45 : 1,
  });

  const btnPrimary = (disabled: boolean) => ({
    ...btnGhost(disabled),
    backgroundColor: disabled ? "transparent" : theme.ink,
    color: disabled ? theme.inkTertiary : theme.surface,
    borderColor: disabled ? theme.rule : theme.ink,
  });

  return (
    <div
      ref={shellRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.shell,
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem clamp(1rem, 3vw, 1.5rem)",
          borderBottom: `1px solid ${theme.shellHairline}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap", justifySelf: "start" }}>
          <Link
            href="/report"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: theme.chromeFg,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            보고서
          </Link>
          <Link
            href="/"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: theme.chromeFgMuted,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            홈
          </Link>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.2em",
            color: theme.chromeFgMuted,
            textTransform: "uppercase",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          FAM · Deck
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "flex-end", justifySelf: "end" }}>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: theme.chromeFgMuted,
              fontFeatureSettings: '"tnum"',
              letterSpacing: "0.02em",
            }}
          >
            {String(currentSlide + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            aria-pressed={isBrowserFullscreen}
            title="전체화면 (F)"
            style={{
              padding: "0.45rem 0.95rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: theme.shell,
              backgroundColor: theme.chromeFg,
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            {isBrowserFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: inset,
          borderRadius: isBrowserFullscreen ? 0 : 3,
          backgroundColor: theme.canvas,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: isBrowserFullscreen ? "none" : "0 32px 64px -24px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ height: 1, backgroundColor: theme.rule, flexShrink: 0, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 1,
              width: `${progress}%`,
              backgroundColor: theme.accent,
              transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: "clamp(1.75rem, 5.5vw, 3.5rem)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header style={{ marginBottom: "clamp(1.65rem, 4.2vw, 2.75rem)" }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.16em",
                color: theme.inkTertiary,
                marginBottom: "0.85rem",
              }}
            >
              SLIDE {String(currentSlide + 1).padStart(2, "0")}
            </div>
            <h1
              style={{
                fontSize: "clamp(2rem, 5.2vw, 2.95rem)",
                fontWeight: 600,
                color: theme.ink,
                margin: "0 0 0.55rem",
                lineHeight: 1.18,
                letterSpacing: "-0.03em",
                maxWidth: "52rem",
              }}
            >
              {slide.title}
            </h1>
            <p
              style={{
                fontSize: "clamp(1.1rem, 2.4vw, 1.4rem)",
                color: theme.inkTertiary,
                margin: 0,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                maxWidth: "46rem",
                lineHeight: 1.55,
              }}
            >
              {slide.subtitle}
            </p>
          </header>

          <div style={{ flex: 1, minHeight: 0 }}>{slide.content}</div>
        </div>

        <footer
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem clamp(1.35rem, 4vw, 2.25rem)",
            borderTop: `1px solid ${theme.rule}`,
            backgroundColor: theme.surface,
          }}
        >
          <button type="button" onClick={prevSlide} disabled={currentSlide === 0} style={btnGhost(currentSlide === 0)}>
            이전
          </button>

          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`슬라이드 ${i + 1}`}
                aria-current={currentSlide === i ? "step" : undefined}
                onClick={() => setCurrentSlide(i)}
                style={{
                  width: currentSlide === i ? 28 : 6,
                  height: 4,
                  borderRadius: 1,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  backgroundColor: currentSlide === i ? theme.accent : theme.ruleStrong,
                  transition: "width 0.2s ease, background-color 0.2s ease",
                }}
              />
            ))}
          </div>

          <button type="button" onClick={nextSlide} disabled={currentSlide === SLIDES.length - 1} style={btnPrimary(currentSlide === SLIDES.length - 1)}>
            {currentSlide === SLIDES.length - 1 ? "완료" : "다음"}
          </button>
        </footer>
      </div>

      <p
        style={{
          flexShrink: 0,
          margin: 0,
          padding: "0.4rem clamp(1rem, 3vw, 1.5rem) 0.55rem",
          fontSize: "0.8125rem",
          letterSpacing: "0.04em",
          color: theme.chromeFgMuted,
          textAlign: "center",
          fontWeight: 500,
        }}
      >
        ← → · SPACE · PgUp / PgDn · F fullscreen · Esc
      </p>
    </div>
  );
}
