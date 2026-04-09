import type { Grade, Indicators } from "@/lib/quant-engine";
import type { FundamentalSnapshotForModel } from "@/lib/quant-fundamentals";

/** POST /api/quant/ai-opinion 요청 본문 (클라이언트가 /api/quant/insight 결과에서 추림) */
export interface QuantOpinionRequestPayload {
  ticker: string;
  as_of_date?: string;
  bar_source?: string;
  grade: Grade;
  score: { total: number };
  summary: string;
  primary_signal: { type: string; label: string; strength: number };
  trend_filter: {
    above_ma20: boolean;
    momentum_direction: string;
    contrarian_setup: boolean;
    summary: string;
  };
  indicators: Pick<
    Indicators,
    | "atr_ratio"
    | "vol_ratio20"
    | "ma5_20_spread"
    | "momentum10d"
    | "bb_pct_b"
    | "rsi14"
    | "ma20"
    | "bb_lower"
  >;
  entry?: {
    stop_loss_pct: number | null;
    timing_label: string;
  };
  /** 크롤/페이지에서 넘기는 기사 제목 */
  article_title?: string;
  /** 본문 일부(너무 길면 클라이언트에서 잘라서 전달) */
  article_excerpt?: string;
  /** 분류 JSON 기반 (선택) */
  sentiment_label_ko?: string;
  article_primary_type_ko?: string;
  catalyst_label_ko?: string;
  /**
   * 서버 전용: `/api/quant/ai-opinion`에서 yfinance 스냅샷을 붙임.
   * 클라이언트는 보내지 않는 것을 권장(내도 서버에서 덮어씀).
   */
  fundamentals_snapshot?: FundamentalSnapshotForModel | null;
}

/** 사이드바 AI 해석 블록(불릿·한줄정리) */
export type QuantOpinionLayout = {
  signalLabel: string;
  bullets: string[];
  takeaway: string;
};

function splitSummaryBullets(text: string, maxItems = 6): string[] {
  const t = text.replace(/\r/g, "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  let chunks = t
    .split(/(?<=[.!?。？！])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  if (chunks.length <= 1) {
    chunks = t
      .split(/(?<=다\.|요\.|니다\.|습니다\.)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);
  }
  if (chunks.length <= 1) {
    chunks = t
      .split(/\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);
  }
  if (chunks.length === 0) return [t];
  return chunks.slice(0, maxItems);
}

export function buildQuantOpinionLayout(
  p: QuantOpinionRequestPayload,
  lines: string[],
  source: "gemini" | "template"
): QuantOpinionLayout {
  const signalLabel = p.primary_signal.label;
  const takeaway =
    (lines[1] ?? "").trim() ||
    "지표만으로는 한쪽으로 단정하긴 어렵습니다.";

  const geminiFirst = (lines[0] ?? "").trim();
  const fromGemini =
    source === "gemini" ? splitSummaryBullets(geminiFirst) : [];
  const fromEngine = splitSummaryBullets(p.summary.trim());

  let bullets: string[];
  if (source === "gemini" && fromGemini.length >= 2) {
    bullets = fromGemini;
  } else if (fromEngine.length > 0) {
    bullets = fromEngine;
  } else if (fromGemini.length > 0) {
    bullets = fromGemini;
  } else if (p.summary.trim()) {
    bullets = [p.summary.trim()];
  } else if (geminiFirst) {
    bullets = [geminiFirst];
  } else {
    bullets = [takeaway];
  }

  const filtered = bullets.filter(
    (b) => !/^총점\s*\d+/.test(b) && !/^핵심 패턴[:：]/.test(b)
  );
  const finalBullets = filtered.length ? filtered : bullets;

  return {
    signalLabel,
    bullets: finalBullets.slice(0, 6),
    takeaway,
  };
}

function fundamentalsTemplateHint(p: QuantOpinionRequestPayload): string | null {
  const f = p.fundamentals_snapshot;
  if (!f || f.data_quality === "missing") return null;
  const pe =
    typeof f.metrics.trailingPE === "number"
      ? f.metrics.trailingPE
      : typeof f.metrics.forwardPE === "number"
        ? f.metrics.forwardPE
        : null;
  const pb = typeof f.metrics.priceToBook === "number" ? f.metrics.priceToBook : null;
  const parts: string[] = [];
  if (pe !== null) parts.push(`스냅샷 기준 이익 배수는 대략 ${pe}배 수준으로 읽힙니다`);
  if (pb !== null) parts.push(`순자산 대비 가격 비율은 대략 ${pb}배로 잡혀 있습니다`);
  if (parts.length === 0) return null;
  return `${parts.join(", ")}. 공개 요약 수치라 시점·정확도는 제한적입니다.`;
}

export function templateQuantOpinionKo(p: QuantOpinionRequestPayload): string[] {
  const { grade, score, primary_signal } = p;
  const sig = primary_signal.label;
  const tilt =
    grade === "D"
      ? "지표만 놓고 보면 지금은 새로 사 들이기보다 지켜보거나 손실부터 줄이는 쪽이 덜 부담스럽다고 볼 수 있습니다."
      : primary_signal.type === "MOMENTUM_WARNING"
        ? "단기로 너무 많이 올랐을 수 있어, 무작정 따라 붙기보다는 한 박자 쉬는 편이 나을 수 있습니다."
        : grade === "A" || grade === "B"
          ? "지표만 보면 상대적으로 나은 편에 가깝습니다. 그래도 소액·여러 번 나눠 보는 식으로 신중하게 접근하는 편이 좋습니다."
          : "지표가 ‘무조건 사’ 또는 ‘무조건 팔’ 쪽으로만 쏠리지는 않아, 큰 한 방보다는 오르내림을 가정하는 편이 가깝습니다.";

  const line1 = `총점 ${score.total}점 · 등급 ${grade}. 핵심 패턴: 「${sig}」`;
  const fund = fundamentalsTemplateHint(p);
  const line2 = fund ? `${tilt} ${fund}` : tilt;
  return [line1, line2];
}

export function isQuantOpinionPayload(v: unknown): v is QuantOpinionRequestPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.ticker !== "string" || !o.ticker) return false;
  if (!["A", "B", "C", "D"].includes(o.grade as string)) return false;
  if (!o.score || typeof o.score !== "object") return false;
  const s = o.score as Record<string, unknown>;
  if (typeof s.total !== "number" || !Number.isFinite(s.total)) return false;
  if (typeof o.summary !== "string") return false;
  if (!o.primary_signal || typeof o.primary_signal !== "object") return false;
  if (!o.trend_filter || typeof o.trend_filter !== "object") return false;
  if (!o.indicators || typeof o.indicators !== "object") return false;
  const optStr = (k: string) => {
    const x = o[k];
    return x === undefined || typeof x === "string";
  };
  if (!optStr("article_title") || !optStr("article_excerpt")) return false;
  if (!optStr("sentiment_label_ko") || !optStr("article_primary_type_ko") || !optStr("catalyst_label_ko"))
    return false;
  return true;
}
