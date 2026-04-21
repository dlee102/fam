"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { isAnchorSpaceTarget, isEditableKeyTarget } from "@/lib/presentation-keynav";

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
} as const;

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: T.surface,
      border: `1px solid ${T.rule}`,
      borderRadius: 2,
      padding: "clamp(1rem,2.5vw,1.5rem)",
      ...style,
    }}>
      {children}
    </div>
  );
}

const SLIDES: Array<{
  label: string;
  title: string;
  subtitle: string;
  content: ReactNode;
}> = [
  {
    label: "표지",
    title: "기사에 붙는 퀀트 지표 인사이트",
    subtitle: "기획 관점에서, 왜 붙이고 무엇이 좋아지는지",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <p style={{ fontSize: "clamp(1.2rem,2.8vw,1.55rem)", color: T.inkSec, lineHeight: 1.65, maxWidth: "48rem", margin: 0 }}>
          종목 뉴스를 읽는 순간, 옆에서 <strong>차트·점수·한 줄 요약</strong>이 같이 보이면
          사용자는 &ldquo;감만으로 읽기&rdquo;에서 <strong>근거를 보며 읽기</strong>로 바뀝니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {["신뢰", "체류", "결심 속도", "매매·관심 전환"].map((t) => (
            <span key={t} style={{
              fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.08em",
              color: T.accent, background: T.accentMuted, padding: "0.35rem 0.75rem", borderRadius: 3,
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "상황",
    title: "뉴스만 있을 때 생기는 일",
    subtitle: "사용자 입장에서 흔한 마찰",
    content: (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        {[
          { h: "불안·망설임", b: "호재인지, 이미 오른 건지, 변동은 얼마나 큰지 문장만으로는 감이 잘 안 잡힙니다." },
          { h: "다른 앱으로 이동", b: "차트·재무를 보려고 검색·이탈이 나기 쉽습니다. 그 사이 흐름이 끊깁니다." },
          { h: "콘텐츠와 행동의 거리", b: "읽고 나서 ‘그래서 지금 사야 하나?’까지 한 화면에서 이어지기 어렵습니다." },
        ].map((x) => (
          <Card key={x.h} style={{ borderLeft: `3px solid ${T.accent}` }}>
            <div style={{ fontWeight: 700, color: T.ink, marginBottom: "0.5rem", fontSize: "1.05rem" }}>{x.h}</div>
            <p style={{ margin: 0, fontSize: "0.98rem", color: T.inkSec, lineHeight: 1.55 }}>{x.b}</p>
          </Card>
        ))}
      </div>
    ),
  },
  {
    label: "제안",
    title: "같은 화면에 ‘숫자 맥락’을 붙인다",
    subtitle: "기사 = 왜 움직였는지, 지표 = 지금 어디쯤인지",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "46rem" }}>
        <p style={{ margin: 0, fontSize: "clamp(1.05rem,2.2vw,1.25rem)", color: T.inkSec, lineHeight: 1.65 }}>
          퀀트·기술적 지표는 전문가만의 도구가 아니라, <strong>뉴스 한 편을 ‘판단 가능한 정보’로 바꿔 주는 레이어</strong>입니다.
          사용자는 기사를 읽으면서 동시에 <strong>가격 흐름·변동성·상대적 위치</strong>를 눈에 넣을 수 있습니다.
        </p>
        <Card style={{ background: T.accentMuted, borderColor: "transparent" }}>
          <p style={{ margin: 0, fontSize: "1.02rem", color: T.ink, lineHeight: 1.6 }}>
            <strong>한 줄 요약:</strong> 기사는 ‘이야기’, 지표는 ‘지금 장에서의 위치’를 같이 보여 줍니다.
          </p>
        </Card>
      </div>
    ),
  },
  {
    label: "신뢰",
    title: "신뢰는 ‘말’이 아니라 ‘같이 보이는 근거’에서",
    subtitle: "콘텐츠 품질을 보조하는 장치",
    content: (
      <ul style={{
        margin: 0, paddingLeft: "1.25rem", fontSize: "clamp(1.02rem,2vw,1.15rem)",
        color: T.inkSec, lineHeight: 1.75, maxWidth: "44rem",
      }}>
        <li style={{ marginBottom: "0.65rem" }}>기사 내용과 <strong>같은 종목·같은 시점</strong>을 기준으로 숫자가 붙으면, ‘꾸민 추천’이 아니라 <strong>검증 가능한 맥락</strong>으로 느껴집니다.</li>
        <li style={{ marginBottom: "0.65rem" }}>점수·등급·요약은 <strong>일관된 규칙</strong>으로 계산되므로, 기사마다 다른 잣대가 아니라는 인상을 줍니다.</li>
        <li>과장된 문구보다 <strong>차트와 수치</strong>가 옆에 있을 때, 사용자는 스스로 판단할 여지를 더 믿습니다.</li>
      </ul>
    ),
  },
  {
    label: "행동",
    title: "매매·관심이 늘어나는 이유 (쉬운 설명)",
    subtitle: "직접적인 ‘사세요’가 아니라, 결심 전 단계를 줄여 줌",
    content: (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {[
          { h: "이탈 감소", b: "다른 곳에서 차트 찾느라 나갔다가 안 돌아오는 경우를 줄입니다." },
          { h: "결심까지 시간 단축", b: "‘지금 비싼가 / 싼가’를 같은 화면에서 빠르게 감을 잡을 수 있습니다." },
          { h: "행동으로의 다리", b: "관심 종목 등록·알림·주문까지의 단계가 가까워지면, 전환은 자연스럽게 따라올 수 있습니다." },
        ].map((x) => (
          <Card key={x.h}>
            <div style={{ fontWeight: 700, color: T.accent, marginBottom: "0.45rem" }}>{x.h}</div>
            <p style={{ margin: 0, fontSize: "0.98rem", color: T.inkSec, lineHeight: 1.55 }}>{x.b}</p>
          </Card>
        ))}
      </div>
    ),
  },
  {
    label: "구성",
    title: "사용자에게는 이렇게 보이면 충분합니다",
    subtitle: "내부 이름보다 ‘무슨 도움인지’가 먼저",
    content: (
      <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        {[
          { k: "종합 점수·등급", d: "한눈에 ‘지금 톤’을 받아들이기 쉽게" },
          { k: "가격·변동 요약", d: "최근 흐름과 변동 크기를 짧게" },
          { k: "AI 한 줄 설명", d: "숫자를 사람 말로 짧게 풀어 줌" },
          { k: "밸류·재무 요약", d: "단기뿐 아니라 회사 체력 맥락" },
          { k: "뉴스 전후 수익 곡선", d: "‘발행 후 시장이 어떻게 반응했는지’ 시각화" },
        ].map((it) => (
          <Card key={it.k} style={{ borderTop: `2px solid ${T.accent}` }}>
            <div style={{ fontWeight: 700, color: T.ink, marginBottom: "0.35rem" }}>{it.k}</div>
            <div style={{ fontSize: "0.92rem", color: T.inkTer, lineHeight: 1.45 }}>{it.d}</div>
          </Card>
        ))}
      </div>
    ),
  },
  {
    label: "지표",
    title: "기획·사업에서 보면 좋은 것들",
    subtitle: "출시 후 숫자로 대화하기",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "46rem" }}>
        <p style={{ margin: 0, fontSize: "1.02rem", color: T.inkSec, lineHeight: 1.6 }}>
          아래는 예시입니다. 실제 목표는 서비스 단계에 맞춰 정하면 됩니다.
        </p>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {[
            "기사당 체류 시간·스크롤 깊이",
            "지표 영역 노출 후 이탈 vs 다음 기사 이동",
            "관심 종목·알림·주문 퍼널 전환",
            "유료 기사 vs 무료 기사 행동 차이",
          ].map((s) => (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: "0.65rem",
              padding: "0.65rem 0.85rem", background: T.surface, border: `1px solid ${T.rule}`, borderRadius: 2,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.up, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: "0.98rem", color: T.ink }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "정리",
    title: "한 장으로 말하면",
    subtitle: "스테이크홀더용 메시지",
    content: (
      <blockquote style={{
        margin: 0, padding: "clamp(1.25rem,3vw,1.75rem)",
        borderLeft: `4px solid ${T.accent}`,
        background: T.surface,
        border: `1px solid ${T.rule}`,
        borderRadius: 2,
        maxWidth: "46rem",
      }}>
        <p style={{
          margin: 0, fontSize: "clamp(1.15rem,2.6vw,1.45rem)", fontWeight: 600,
          color: T.ink, lineHeight: 1.55, fontStyle: "normal",
        }}>
          기사에 퀀트·기술적 지표를 붙이면, 사용자는 <strong>더 안심하고 더 오래 보고</strong>,
          결정까지의 길이 짧아집니다. 그 결과 <strong>매매와 관심이 늘어날 여지</strong>가 커집니다.
        </p>
        <p style={{ margin: "1rem 0 0", fontSize: "0.95rem", color: T.inkTer, lineHeight: 1.5 }}>
          (투자 권유가 아니라 정보 제공입니다. 문구·고지는 법무·컴플라이언스 기준에 맞춥니다.)
        </p>
      </blockquote>
    ),
  },
];

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

export default function QuantIndicatorPmPresentationPage() {
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
      if (isEditableKeyTarget(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === " ") {
        if (isAnchorSpaceTarget(e.target)) return;
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFS();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
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
          <Link href="/presentation/quant-insight" style={{ fontSize: "0.875rem", fontWeight: 500, color: T.chromeFgMuted, textDecoration: "none" }}>
            기능 상세 덱
          </Link>
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.2em", color: T.chromeFgMuted,
          textTransform: "uppercase", textAlign: "center", whiteSpace: "nowrap" }}>
          FAM · 퀀트 지표 (기획)
        </span>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "flex-end", justifySelf: "end" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: T.chromeFgMuted, fontFeatureSettings: '"tnum"' }}>
            {String(cur + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </span>
          <button type="button" onClick={() => void toggleFS()} aria-pressed={fs} title="전체화면 (F)" style={{
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

        <div style={{
          flex: 1, minHeight: 0, overflow: "auto",
          padding: "clamp(1.75rem,5.5vw,3.25rem)", display: "flex", flexDirection: "column",
        }}>
          <header style={{ marginBottom: "clamp(1.25rem,3.5vw,2rem)" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.16em", color: T.inkTer, marginBottom: "0.6rem" }}>
              {slide.label}
            </div>
            <h1 style={{ fontSize: "clamp(1.85rem,5vw,2.65rem)", fontWeight: 600, color: T.ink,
              margin: "0 0 0.5rem", lineHeight: 1.18, letterSpacing: "-0.03em", maxWidth: "52rem" }}>
              {slide.title}
            </h1>
            <p style={{ fontSize: "clamp(1.05rem,2.2vw,1.3rem)", color: T.inkTer, margin: 0,
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
