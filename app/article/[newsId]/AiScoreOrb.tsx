"use client";

import { useId } from "react";

export type QuantStance = "buy" | "sell" | "neutral";

/** 등급 → 매수·중립·매도 (표시용) */
export function quantStanceFromGrade(grade: string): QuantStance {
  if (grade === "A" || grade === "B") return "buy";
  if (grade === "D") return "sell";
  return "neutral";
}

const STANCE_KO: Record<QuantStance, string> = {
  buy: "매수",
  sell: "매도",
  neutral: "중립",
};

export function quantStanceLabel(stance: QuantStance): string {
  return STANCE_KO[stance];
}

/** 원·막대 채움 비율 (태도 시각화) */
const STANCE_RING_PCT: Record<QuantStance, number> = {
  buy: 78,
  neutral: 50,
  sell: 24,
};

export function quantStanceBarPct(grade: string): number {
  return STANCE_RING_PCT[quantStanceFromGrade(grade)];
}

/** 눈에 띄게 구분되는 태도별 색 (다크 UI 기준 고채도) */
export const STANCE_THEME: Record<
  QuantStance,
  {
    /** 그라데이션·링 메인 */
    accent: string;
    /** 그라데이션 중간 */
    accentMid: string;
    /** 글로우·보조 */
    accentDeep: string;
    /** 한글 라벨 글자색 */
    label: string;
    /** 하단 막대 그라데이션 */
    barGradient: string;
  }
> = {
  buy: {
    accent: "#22c55e",
    accentMid: "#4ade80",
    accentDeep: "#15803d",
    label: "#86efac",
    barGradient: "linear-gradient(90deg, #15803d 0%, #22c55e 45%, #4ade80 100%)",
  },
  sell: {
    accent: "#f87171",
    accentMid: "#fca5a5",
    accentDeep: "#dc2626",
    label: "#fecaca",
    barGradient: "linear-gradient(90deg, #b91c1c 0%, #ef4444 40%, #f87171 100%)",
  },
  neutral: {
    accent: "#eab308",
    accentMid: "#facc15",
    accentDeep: "#a16207",
    label: "#fef08a",
    barGradient: "linear-gradient(90deg, #a16207 0%, #eab308 45%, #fde047 100%)",
  },
};

export function quantStanceTheme(grade: string) {
  return STANCE_THEME[quantStanceFromGrade(grade)];
}

export function quantStanceBarGradient(grade: string): string {
  return quantStanceTheme(grade).barGradient;
}

/** 알고리즘 시그널 0~100 점수용 게이지 색 (낮음→회색, 중간→황, 높음→록) */
export function algoSignalBarGradient(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 66) return STANCE_THEME.buy.barGradient;
  if (s >= 33) return STANCE_THEME.neutral.barGradient;
  return "linear-gradient(90deg, #57534e 0%, #78716c 50%, #a8a29e 100%)";
}

/** 종합 점수(퀀트+알고리즘 합산) 0~100 → 게이지 색 */
export const compositeScoreGradient = algoSignalBarGradient;

/**
 * 퀀트 기술 점수 + 알고리즘 시그널 → 종합 점수
 * - 퀀트 80% : 알고리즘 20%
 * - 알고리즘 미수집 시 퀀트 단독 사용
 */
export function computeCompositeScore(
  quantTotal: number,
  algoTotal: number | null
): number {
  if (algoTotal === null) return quantTotal;
  return Math.round(quantTotal * 0.8 + algoTotal * 0.2);
}

/**
 * 원형 오브 — 중앙 큰 글자: 등급(A–D), 아래 작은 글자: 태도(매수·매도·중립). 글로우 없음.
 */
export function AiScoreOrb({ grade }: { grade: string }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `quant-ai-grad-${uid}`;

  const stance = quantStanceFromGrade(grade);
  const quantLabel = STANCE_KO[stance];
  const ringPct = STANCE_RING_PCT[stance];
  const th = STANCE_THEME[stance];

  /** 등급은 글자 한 자, 태도는 보조 한 줄 — 사이드바 텍스트와 중복 최소화 */
  const mainLine = grade;
  const mainFill = th.label;
  const subLine = quantLabel;
  const subFill = "var(--quant-faint)";

  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference * (1 - ringPct / 100);

  const aria = `등급 ${grade}, ${quantLabel}`;

  const orbStance = stance;

  return (
    <div
      className={`quant-ai-orb quant-ai-orb--${orbStance}`}
      role="img"
      aria-label={aria}
    >
      <svg className="quant-ai-orb__svg" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={th.accentDeep} stopOpacity="1" />
            <stop offset="45%" stopColor={th.accentMid} stopOpacity="0.95" />
            <stop offset="100%" stopColor={th.accent} stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <circle
          className="quant-ai-orb__bg-ring"
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--quant-grid)"
          strokeWidth="1"
          opacity={0.55}
        />

        <g className="quant-ai-orb__g quant-ai-orb__g--cw">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="1.35"
            strokeDasharray="18 42"
            strokeLinecap="round"
            opacity={0.95}
          />
        </g>

        <g className="quant-ai-orb__g quant-ai-orb__g--ccw">
          <circle
            cx="50"
            cy="50"
            r="39"
            fill="none"
            stroke={th.accentMid}
            strokeWidth="0.85"
            strokeDasharray="3 5"
            opacity={0.55}
          />
        </g>

        <g transform="rotate(-90 50 50)">
          <circle
            className="quant-ai-orb__track"
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="var(--quant-rule)"
            strokeWidth="4"
          />
          <circle
            className="quant-ai-orb__progress"
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </g>

        <text
          x="50"
          y="46"
          textAnchor="middle"
          className="quant-ai-orb__stance quant-ai-orb__stance--grade"
          fill={mainFill}
        >
          {mainLine}
        </text>
        <text
          x="50"
          y="58"
          textAnchor="middle"
          className="quant-ai-orb__sub quant-ai-orb__sub--stance"
          fill={subFill}
        >
          {subLine}
        </text>
      </svg>
    </div>
  );
}
