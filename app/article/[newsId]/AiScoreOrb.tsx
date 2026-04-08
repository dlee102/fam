"use client";

import { useId } from "react";

/**
 * 자비스 HUD 느낌의 원형 AI 점수 오브 (SVG + CSS 애니메이션)
 */
export function AiScoreOrb({ score, grade }: { score: number; grade: string }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `quant-ai-grad-${uid}`;
  const glowId = `quant-ai-glow-${uid}`;

  const clamped = Math.min(100, Math.max(0, score));
  const accent =
    grade === "A"
      ? "var(--quant-up)"
      : grade === "B"
        ? "#0ea5e9"
        : grade === "C"
          ? "var(--quant-muted)"
          : "var(--quant-down)";

  // 원주에 맞는 호 길이 (r=38 기준 대략 238)
  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className="quant-ai-orb" aria-hidden>
      <svg className="quant-ai-orb__svg" viewBox="0 0 100 100" role="img">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.85" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.6" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 배경 링 */}
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

        {/* 회전 세그먼트 링 (바깥) */}
        <g className="quant-ai-orb__g quant-ai-orb__g--cw">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="1.25"
            strokeDasharray="18 42"
            strokeLinecap="round"
            opacity={0.85}
            filter={`url(#${glowId})`}
          />
        </g>

        {/* 역회전 점선 링 */}
        <g className="quant-ai-orb__g quant-ai-orb__g--ccw">
          <circle
            cx="50"
            cy="50"
            r="39"
            fill="none"
            stroke={accent}
            strokeWidth="0.75"
            strokeDasharray="3 5"
            opacity={0.45}
          />
        </g>

        {/* 점수 진행 호 */}
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
            filter={`url(#${glowId})`}
          />
        </g>

        {/* 펄스 스캔 링 */}
        <circle
          className="quant-ai-orb__pulse"
          cx="50"
          cy="50"
          r="32"
          fill="none"
          stroke={accent}
          strokeWidth="0.5"
          opacity={0.35}
        />

        {/* 중앙 라벨 */}
        <text
          x="50"
          y="46"
          textAnchor="middle"
          className="quant-ai-orb__score"
          fill="var(--quant-text)"
        >
          {clamped}
        </text>
        <text x="50" y="60" textAnchor="middle" className="quant-ai-orb__sub" fill="var(--quant-faint)">
          AI
        </text>
      </svg>
    </div>
  );
}
