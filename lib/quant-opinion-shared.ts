import type { Grade, Indicators } from "@/lib/quant-engine";
import type { FundamentalSnapshotForModel } from "@/lib/quant-fundamentals";

/** POST /api/quant/ai-opinion 요청 본문 (클라이언트가 /api/quant/insight 결과에서 추림) */
export interface QuantOpinionRequestPayload {
  ticker: string;
  as_of_date?: string;
  bar_source?: string;
  grade: Grade;
  score: { total: number };
  /** 퀀트 기술(80%) + 알고리즘 시그널(20%) 합산. 알고리즘 없으면 quant total 그대로 */
  composite_score?: number;
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
    | "ma5"
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

/** Gemini 미성공 시 AI 카드 비움 — 엔진 요약을 대신 끼워 넣지 않음 */
export function emptyQuantOpinionLayout(): QuantOpinionLayout {
  return { signalLabel: "", bullets: [], takeaway: "" };
}

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
  const line0 = (lines[0] ?? "").trim();
  const line1 = (lines[1] ?? "").trim();
  const takeaway = line1 || "차트만으로는 방향을 단정하기 어렵습니다.";

  let bullets: string[];
  if (source === "template") {
    // template: lines[0]을 그대로 bullet으로 씀 (엔진 summary 재사용 금지)
    bullets = line0 ? splitSummaryBullets(line0) : [];
    if (bullets.length === 0 && line0) bullets = [line0];
  } else {
    // gemini: 첫 줄에서 bullet 추출, 부족하면 엔진 summary 보완
    const fromGemini = splitSummaryBullets(line0);
    const fromEngine = splitSummaryBullets(p.summary.trim());
    if (fromGemini.length >= 2) {
      bullets = fromGemini;
    } else if (fromGemini.length > 0) {
      bullets = fromGemini;
    } else if (fromEngine.length > 0) {
      bullets = fromEngine;
    } else {
      bullets = line0 ? [line0] : [takeaway];
    }
  }

  const filtered = bullets.filter(
    (b) => !/^총점\s*\d+/.test(b) && !/^핵심 패턴[:：]/.test(b) && !/^차트 패턴[:：]/.test(b)
  );
  const finalBullets = filtered.length ? filtered : bullets;

  return {
    signalLabel,
    bullets: finalBullets.slice(0, 6),
    takeaway,
  };
}

function formatKrwInt(n: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(Math.round(n))}원`;
}

/** 퀀트스코어(0~99)를 비전문가용 한 줄로 — 확정·수익 보장 톤 금지 */
export function quantScorePlainKo(score: number): string {
  const s = Math.round(Math.max(0, Math.min(99, score)));
  if (s >= 70) {
    return "당분간 주가가 나아질 쪽에 조금 더 무게를 둔 셈으로 모델이 보는 편입니다";
  }
  if (s <= 35) {
    return "당분간 주가가 부담되는 쪽에 더 무게를 둔 셈으로 모델이 보는 편입니다";
  }
  return "당분간 주가가 오를지 내릴지 모델이 보기엔 중간쯤으로 잡혀 있습니다";
}

/** Gemini 미사용·실패 시에도 한 줄 정리가 퀀트스코어·가격 기준으로 떨어지도록 */
function templatePositionHintKo(p: QuantOpinionRequestPayload): string {
  const ma20 = p.indicators.ma20;
  const bbLower = p.indicators.bb_lower;
  const stop = p.entry?.stop_loss_pct ?? null;
  const mom10 = p.indicators.momentum10d;
  const above = p.trend_filter.above_ma20;
  const md = p.trend_filter.momentum_direction;
  const qs =
    p.composite_score !== undefined && Number.isFinite(p.composite_score)
      ? `퀀트스코어 ${Math.round(p.composite_score)}점(0~99)은 ${quantScorePlainKo(p.composite_score)} `
      : "";

  const chunks: string[] = [];
  if (ma20 !== null) {
    if (!above && md === "RISING") {
      chunks.push(
        `20일 평균 ${formatKrwInt(ma20)} 아래에서 반등 흐름이므로, 평균선 위·아래를 오가는지가 다음 구간의 기준`
      );
    } else if (!above && md === "FALLING") {
      chunks.push(
        `20일 평균 ${formatKrwInt(ma20)} 아래에서 최근 10일 흐름도 약해, 평균가 회복 전까지는 비중을 크게 두기 어렵다고 볼 수 있음`
      );
    } else if (!above) {
      chunks.push(`20일 평균 ${formatKrwInt(ma20)} 아래에 머무는 구간으로, 평균가 대비 종가 위치가 갈림`);
    } else {
      chunks.push(`20일 평균 ${formatKrwInt(ma20)} 위를 유지하는지가 흐름을 이어가는 데 핵심`);
    }
  }
  if (bbLower !== null && !above) {
    chunks.push(`최근 가격 바닥 근처 ${formatKrwInt(bbLower)} 부근에서 반등하는지 여부`);
  }
  if (stop !== null) {
    chunks.push(`약 ${stop}%쯤 빠지면 손해를 끊는 기준을 잡아볼 수 있음`);
  }

  if (chunks.length > 0) {
    return `${qs}${chunks.join(" · ")}으로 볼 수 있습니다.`.trim();
  }
  if (mom10 !== null) {
    return `${qs}최근 10일 흐름이 ${mom10 >= 0 ? "+" : ""}${mom10.toFixed(1)}%라, 다음 구간에서 변동이 커질 수 있다고 볼 수 있습니다.`.trim();
  }
  const tail = p.trend_filter.summary?.trim()
    ? `${p.trend_filter.summary.trim()} 차트만으로는 한쪽으로 단정하긴 어렵다고 볼 수 있습니다.`
    : "차트만으로는 한쪽으로 단정하긴 어렵습니다.";
  return `${qs}${tail}`.trim();
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
  const { grade, score, composite_score } = p;
  const above = p.trend_filter.above_ma20;
  const md = p.trend_filter.momentum_direction;
  const mom10 = p.indicators.momentum10d;
  // ma20 없으면 ma5로 대체 (5일 평균 = 최근 며칠 데이터 기준)
  const ma20 = p.indicators.ma20;
  const ma5 = p.indicators.ma5 ?? null;
  const refMA = ma20 ?? ma5;
  const refMALabel = ma20 !== null ? "20일 평균" : "최근 5일 평균";
  const stop = p.entry?.stop_loss_pct ?? null;
  const qs =
    composite_score !== undefined && Number.isFinite(composite_score)
      ? Math.round(composite_score)
      : null;

  // ── Line 1 (bullet) ──────────────────────────────────────────────────
  const scorePart =
    qs !== null
      ? `퀀트스코어 ${qs}점(0~99) — ${qs >= 70 ? "모델상 우호적" : qs <= 35 ? "모델상 부담 구간" : "모델상 중간"}`
      : `기술 점수 ${score.total}점`;

  let situationPart = "";
  if (mom10 !== null && Math.abs(mom10) >= 3) {
    situationPart = `, 최근 10일 ${mom10 >= 0 ? "+" : ""}${mom10.toFixed(1)}% ${mom10 < 0 ? "밀려 흐름이 약한 편" : "올라 탄력 중"}`;
  } else if (!above && md === "FALLING") {
    situationPart = ", 평균 아래에서 내림세";
  } else if (!above && md === "RISING") {
    situationPart = ", 평균 아래지만 반등 흐름";
  } else if (above && md === "FALLING") {
    situationPart = ", 평균 위지만 단기 눌림";
  } else if (above && md === "RISING") {
    situationPart = ", 평균 위에서 오름세";
  }

  const line1 = `${scorePart}${situationPart}, 등급 ${grade}.`;

  // ── Line 2 (takeaway) ─────────────────────────────────────────────────
  const chunks: string[] = [];

  if (refMA !== null) {
    const maFmt = formatKrwInt(refMA);
    if (!above && md === "FALLING") {
      chunks.push(`${refMALabel}(${maFmt}) 아래에서 내림세라 지금 당장 새로 사기엔 부담이 큽니다`);
    } else if (!above && md === "RISING") {
      chunks.push(`${refMALabel}(${maFmt}) 아래지만 반등 중 — 평균선을 회복하는지가 다음 구간의 핵심입니다`);
    } else if (above && md === "FALLING") {
      chunks.push(`${refMALabel}(${maFmt}) 위이지만 단기 눌림 — 평균선 아래로 내려가지 않는지 확인이 필요합니다`);
    } else {
      chunks.push(`${refMALabel}(${maFmt}) 위를 유지하는 흐름입니다`);
    }
  } else {
    // 이동평균 모두 없음 → 모멘텀·방향으로만
    if (!above && md === "FALLING") {
      if (mom10 !== null) {
        chunks.push(`최근 10일 ${mom10.toFixed(1)}% 내려오는 중이라 지금 새로 사기엔 부담이 있습니다`);
      } else {
        chunks.push("최근 흐름이 내려가고 있어 부담이 큰 구간입니다");
      }
    } else if (!above && md === "RISING") {
      chunks.push("아직 반등 초입 — 흐름이 이어지는지 조금 더 지켜볼 만합니다");
    } else if (above && md === "RISING") {
      chunks.push("흐름이 올라가는 구간입니다");
    } else if (mom10 !== null) {
      chunks.push(
        `최근 10일 흐름 ${mom10 >= 0 ? "+" : ""}${mom10.toFixed(1)}%라 ${mom10 < 0 ? "부담이 남아 있는 구간" : "방향은 나쁘지 않은 편"}입니다`
      );
    }
  }

  if (stop !== null) {
    chunks.push(`약 ${stop}%쯤 더 빠지면 손해를 끊는 기준을 잡아볼 수 있습니다`);
  }

  const fund = fundamentalsTemplateHint(p);
  const base =
    chunks.length > 0
      ? chunks.join(". ")
      : (p.trend_filter.summary?.trim() || "차트만으로는 방향을 단정하기 어렵습니다");
  const line2 = fund ? `${base} ${fund}` : base;

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
