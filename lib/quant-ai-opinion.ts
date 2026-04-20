import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  geminiModelCandidates,
  isGeminiModelNotFoundError,
} from "@/lib/gemini-model-order";
import {
  buildQuantOpinionLayout,
  emptyQuantOpinionLayout,
  isQuantOpinionPayload,
  quantScorePlainKo,
  type QuantOpinionLayout,
  type QuantOpinionRequestPayload,
} from "@/lib/quant-opinion-shared";

export type { QuantOpinionLayout, QuantOpinionRequestPayload } from "@/lib/quant-opinion-shared";
export {
  buildQuantOpinionLayout,
  emptyQuantOpinionLayout,
  isQuantOpinionPayload,
  quantScorePlainKo,
  templateQuantOpinionKo,
} from "@/lib/quant-opinion-shared";

// ── 시그널별 톤·관점 힌트 ──────────────────────────────────────────────
const SIGNAL_TONE_MAP: Record<string, string> = {
  AGGRESSIVE_CONTRARIAN:
    "이 종목은 최근 많이 떨어졌다가 거래가 다시 생기기 시작한 구간이다. " +
    "반등할 여지가 있다는 점은 짚되, 아직 떨어지는 흐름이 끝났다고 단정하면 안 된다.",
  VOLATILITY_SQUEEZE:
    "이 종목은 최근 가격 움직임이 아주 잠잠해진 상태다. " +
    "잠잠했던 만큼 곧 위든 아래든 크게 움직일 수 있다는 점을 전달한다. " +
    "어느 쪽으로 갈지 예단은 하지 않는다.",
  OVERSOLD_REBOUND:
    "이 종목은 너무 많이 빠져서 조금 되돌아올 여지가 있는 구간이다. " +
    "크게 반등한다고 단정하지 말고, 조금 튀어오를 수 있다는 정도만 전달한다.",
  MOMENTUM_WARNING:
    "이 종목은 최근 너무 빨리 올랐다. " +
    "지금 따라 사면 부담이 클 수 있다는 점을 전달하고, " +
    "얼마나 올랐는지를 숫자로 짚어준다. 좀 내려올 때를 기다리는 관점을 보여준다.",
  NEUTRAL:
    "차트만 보면 뚜렷한 모양이 거의 없는 상태다. " +
    "수치 요약에 퀀트스코어(0~99)가 있으면 그 점수를 먼저 쉬운 말로 짚고, 기사와 가격 기준을 이어서 쓴다.",
};

function signalToneHint(signalType: string): string {
  return SIGNAL_TONE_MAP[signalType] ?? SIGNAL_TONE_MAP["NEUTRAL"];
}

// ── 수치 사전 요약 (모델이 JSON을 직접 파싱하지 않아도 핵심값을 볼 수 있게) ──
function buildNumericDigest(p: QuantOpinionRequestPayload): string {
  const lines: string[] = [];
  const { indicators: ind } = p;
  const push = (k: string, v: unknown, unit = "") => {
    if (v !== null && v !== undefined) lines.push(`- ${k}: ${v}${unit}`);
  };
  push("등급", p.grade);
  if (p.composite_score !== undefined && Number.isFinite(p.composite_score)) {
    push("퀀트스코어(0~99)", p.composite_score, "점");
    lines.push(`- 퀀트스코어 한 줄 풀이: ${quantScorePlainKo(p.composite_score)}`);
  } else {
    push("기술 점수(차트)", p.score.total, "점");
  }
  push("차트 패턴 이름", p.primary_signal.label);
  // 이동평균 — ma20 없으면 ma5 대체 표기, 둘 다 없으면 언급 금지 명시
  const indWithMa5 = ind as typeof ind & { ma5?: number | null };
  if (ind.ma20 !== null) {
    push("20일 평균가(ma20)", ind.ma20, "원");
  } else if (indWithMa5.ma5 != null) {
    push("최근 5일 평균가(ma5, ma20 없음)", indWithMa5.ma5, "원");
    lines.push("- ※ MA20 계산 불가. '20일 평균가(데이터 없음)' 같은 표현 절대 금지. 위 5일 평균을 '최근 5일 평균'으로 대체 언급");
  } else {
    lines.push("- ※ 이동평균 없음 — 평균가 관련 언급 자체 금지. 모멘텀·RSI로만 설명");
  }
  push("볼린저 하단(bb_lower)", ind.bb_lower, "원");
  push("손절 기준(stop_loss_pct)", p.entry?.stop_loss_pct, "%");
  push("ATR 비율", ind.atr_ratio !== null ? (ind.atr_ratio as number).toFixed(1) : null, "%");
  push("거래량 비율(20일)", ind.vol_ratio20 !== null ? (ind.vol_ratio20 as number).toFixed(2) : null, "x");
  push("이격도(ma5-20)", ind.ma5_20_spread !== null ? (ind.ma5_20_spread as number).toFixed(2) : null, "%");
  push("10일 모멘텀", ind.momentum10d !== null ? (ind.momentum10d as number).toFixed(1) : null, "%");
  push("RSI(14)", ind.rsi14 !== null ? (ind.rsi14 as number).toFixed(1) : null);
  push("BB %B", ind.bb_pct_b !== null ? (ind.bb_pct_b as number).toFixed(2) : null);
  push("추세 방향", `MA20 ${p.trend_filter.above_ma20 ? "위" : "아래"}, 모멘텀 ${p.trend_filter.momentum_direction}`);
  return lines.join("\n");
}

function buildUserMessage(p: QuantOpinionRequestPayload): string {
  const {
    fundamentals_snapshot,
    article_title,
    article_excerpt,
    sentiment_label_ko,
    article_primary_type_ko,
    catalyst_label_ko,
    ...quantCore
  } = p;

  const cleanIndicators = Object.fromEntries(
    Object.entries(quantCore.indicators).filter(([, v]) => v !== null)
  );
  const cleanEntry = quantCore.entry
    ? {
        ...quantCore.entry,
        ...(quantCore.entry.stop_loss_pct === null
          ? {}
          : { stop_loss_pct: quantCore.entry.stop_loss_pct }),
      }
    : undefined;
  if (cleanEntry && cleanEntry.stop_loss_pct === null) {
    delete (cleanEntry as Record<string, unknown>).stop_loss_pct;
  }
  // summary 필드는 프롬프트 수치 요약에서 이미 제공 → JSON에서 제외해 Gemini가 그대로 베끼는 것을 방지
  const { summary: _omittedSummary, ...quantCoreWithoutSummary } = quantCore;
  void _omittedSummary;
  const cleanCore = {
    ...quantCoreWithoutSummary,
    indicators: cleanIndicators,
    ...(cleanEntry ? { entry: cleanEntry } : {}),
  };

  const data: string[] = [];

  data.push("=== 기사 ===");
  if (article_title?.trim()) data.push(`제목: ${article_title.trim()}`);
  if (article_excerpt?.trim()) {
    data.push(`본문 발췌:\n${article_excerpt.trim()}`);
  } else {
    data.push("본문 발췌: (없음 -- 제목, 퀀트, 분류만으로 작성할 것)");
  }
  if (sentiment_label_ko?.trim() || article_primary_type_ko?.trim() || catalyst_label_ko?.trim()) {
    data.push("=== 기사 분류 메타(참고만, 추측 금지) ===");
    if (sentiment_label_ko?.trim()) data.push(`톤: ${sentiment_label_ko.trim()}`);
    if (article_primary_type_ko?.trim()) data.push(`유형: ${article_primary_type_ko.trim()}`);
    if (catalyst_label_ko?.trim()) data.push(`촉매: ${catalyst_label_ko.trim()}`);
  }

  data.push("=== 퀀트 수치 요약 ===");
  data.push(buildNumericDigest(p));

  data.push("=== 퀀트 JSON (원본) ===");
  data.push(JSON.stringify(cleanCore));

  const stmtN = fundamentals_snapshot?.statement_highlights?.length ?? 0;
  if (
    fundamentals_snapshot &&
    fundamentals_snapshot.data_quality !== "missing" &&
    (Object.keys(fundamentals_snapshot.metrics).length > 0 ||
      fundamentals_snapshot.company_name ||
      stmtN > 0)
  ) {
    data.push("=== 펀더멘탈 요약 (Yahoo Finance, 지연/누락 가능) ===");
    data.push(
      JSON.stringify({
        ticker_key: fundamentals_snapshot.ticker_key,
        yahoo_symbol: fundamentals_snapshot.yahoo_symbol,
        company_name: fundamentals_snapshot.company_name,
        sector: fundamentals_snapshot.sector,
        industry: fundamentals_snapshot.industry,
        data_quality: fundamentals_snapshot.data_quality,
        has_financial_tables: fundamentals_snapshot.has_financial_tables,
        bundle_generated_at: fundamentals_snapshot.bundle_generated_at,
        metrics: fundamentals_snapshot.metrics,
        statement_highlights: fundamentals_snapshot.statement_highlights ?? [],
      })
    );
  }

  const toneHint = signalToneHint(p.primary_signal.type);

  const scorePhrase =
    quantCore.composite_score !== undefined && Number.isFinite(quantCore.composite_score)
      ? `퀀트스코어 ${quantCore.composite_score}점`
      : `기술 점수 ${quantCore.score.total}점`;

  // 수치 요약에서 실제 값을 뽑아 예시 문장에 직접 삽입
  const ma20Val = p.indicators.ma20;
  const stopVal = p.entry?.stop_loss_pct ?? null;
  let exampleSentence = "";
  if (ma20Val !== null && stopVal !== null) {
    const ma20Fmt = new Intl.NumberFormat("ko-KR").format(Math.round(ma20Val));
    exampleSentence =
      `  - 좋은 예: '최근 20일 평균(${ma20Fmt}원)보다 아래에 있어서, 이 가격 위로 올라오는지가 중요하고, 약 ${stopVal}%쯤 더 빠지면 손해를 끊는 기준으로 생각해볼 수 있다'`;
  } else if (ma20Val !== null) {
    const ma20Fmt = new Intl.NumberFormat("ko-KR").format(Math.round(ma20Val));
    exampleSentence =
      `  - 좋은 예: '최근 20일 평균(${ma20Fmt}원) ${p.trend_filter.above_ma20 ? "위" : "아래"}에 있어서, 이 가격을 기준으로 흐름이 바뀌는지 지켜볼 만하다'`;
  }

  const instruction = [
    "=== 작성 지시 ===",
    "",
    `[톤 가이드] ${toneHint}`,
    "",
    "위 데이터를 읽고, 아래 형식 그대로 정확히 2줄만 출력하라.",
    "",
    "BULLET: (1번 문장)",
    "TAKEAWAY: (2번 문장)",
    "",
    ">> BULLET 규칙:",
    `  - 첫머리에 '${scorePhrase}'을 짧게 쓴다.`,
    "  - 퀀트스코어(0~99)가 수치 요약에 있으면, 그 점수가 '모델이 당분간 주가를 어느 쪽으로 더 무겁게 보는지'를 한 번 쉬운 말로 풀어준 뒤, 기사 핵심과 차트 흐름을 이어 쓴다.",
    "  - 퀀트스코어는 참고용 점수이며 수익을 보장하지 않는다는 뉘앙스로 쓴다(단정·확언 금지).",
    "  - 숫자만 늘어놓으면 안 된다. '이런 뉴스가 나왔는데, 모델 점수와 차트를 같이 보면 이런 느낌이다' 식으로 엮는다.",
    "",
    ">> TAKEAWAY 규칙:",
    "  - 독자가 '그래서 어떻게 하면 돼?'에 답하는 한 문장이다.",
    "  - 퀀트스코어가 있으면 한 문장 안에 **점수 한 줄 요약 + 가격 기준 숫자**를 같이 넣는다.",
    "  - 수치 요약에 평균가(20일 or 5일)가 있으면 반드시 넣는다. '최근 5일 평균'이라 적힌 경우 그대로 5일 평균이라 쓰면 된다.",
    "  - 평균가가 수치 요약에 없으면 평균가를 언급하지 않는다. '(데이터 없음)', '정보 없음', 'N/A' 등 어떤 형태의 없음 표현도 절대 금지.",
    "  - X나 XX 같은 빈칸/자리표시자는 절대 쓰지 않는다. 실제 숫자만 쓴다.",
    ...(exampleSentence ? [exampleSentence] : []),
    "  - 위 값이 모두 없으면, 수치 요약에 있는 다른 숫자(변동성 비율, 10일 흐름 % 등)로만 기준을 제시한다.",
    "",
    ">> 말투:",
    "  - 각 문장 180자 이내. 짧게.",
    "  - 투자 전문 용어 금지. '신규 진입'->'새로 사기', '이탈'->'아래로 빠지면', '분할 매수'->'나눠서 사기'.",
    "  - 영어 약어(MA, RSI, ATR) 금지.",
    "  - 데이터에 없는 숫자를 지어내지 않는다.",
    "  - 사라/팔아 같은 확정 지시는 하지 않는다. '~로 볼 수 있다' 식으로 부드럽게.",
  ].join("\n");

  return `${data.join("\n\n")}\n\n${instruction}`;
}

function parseOpinionLines(text: string): string[] {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\*\*/g, "")
    .trim();

  // 1) BULLET: / TAKEAWAY: 마커 기반 추출 (우선)
  const bulletMatch = cleaned.match(/^BULLET:\s*(.+)/m);
  const takeawayMatch = cleaned.match(/^TAKEAWAY:\s*(.+)/m);
  if (bulletMatch?.[1]?.trim() && takeawayMatch?.[1]?.trim()) {
    return [bulletMatch[1].trim(), takeawayMatch[1].trim()];
  }

  // 2) 마커 없이 줄 분리 (폴백)
  const stripped = cleaned.replace(/^[\s\-*•]+/gm, "");
  const raw = stripped.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (raw.length >= 2) return raw.slice(0, 2);

  // 3) 한 줄에 문장이 합쳐진 경우
  if (raw.length === 1) {
    const one = raw[0];
    const byPeriod = one
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (byPeriod.length >= 2) return byPeriod.slice(0, 2);
  }
  return raw.length ? [raw[0], raw[0]] : [];
}

const SYSTEM_HINT = [
  "너는 주식 뉴스를 쉽게 풀어주는 해설자다.",
  "독자는 주식을 처음 시작한 사람이다. 전문 용어를 모른다.",
  "친구에게 말하듯 짧고 쉽게 쓴다.",
  "",
  "[퀀트스코어(ML 모델)]",
  "- 수치 요약에 퀀트스코어(0~99)가 있으면, 차트 숫자와 **같이** 해석의 축으로 삼는다.",
  "- 퀀트스코어는 과거 패턴으로 학습한 모델이 '며칠 안 주가가 오를 쪽·부담 쪽 중 어디에 더 무게를 두는지'를 숫자로 요약한 것이다.",
  "- 점수가 높을수록 모델상 우호적, 낮을수록 모델상 보수적으로 **읽히는 쪽**이라고 풀어 쓴다. 확정 예언·수익 보장은 금지.",
  "",
  "[도메인]",
  "- 종목은 주로 국내 작은 회사(바이오/제약 등)다.",
  "- 뉴스 하나에 주가가 크게 흔들릴 수 있다.",
  "- '안정적이다', '대형주와 비슷하다' 같은 표현은 쓰지 않는다.",
  "",
  "[출력 형식 -- 반드시 이 2줄만 출력]",
  "BULLET: (1번 문장)",
  "TAKEAWAY: (2번 문장)",
  "",
  "[1번 문장 -- BULLET]",
  "- 기사에서 가장 중요한 뉴스가 뭔지, 퀀트스코어(있으면)와 차트가 어떤 상태인지를 한 문장으로 연결한다.",
  "- 퀀트스코어 또는 기술 점수를 첫머리에 짧게 쓴다.",
  "",
  "[2번 문장 -- TAKEAWAY]",
  "- '한 줄 정리'로 표시되는 문장이다. 독자가 '그래서 지금 어떻게 하면 돼?'에 답하는 느낌으로 쓴다.",
  "- 퀀트스코어가 있으면 점수 요약과 가격 기준 숫자를 **한 문장 안에서** 같이 넣는다.",
  "- 반드시 '퀀트 수치 요약'에 있는 실제 숫자(20일 평균가 원 금액, 손절 기준 % 등)를 그대로 넣는다. 없으면 다른 요약 숫자만 쓴다.",
  "- 예: '지난 20일 평균(7,508원)보다 아래에 있어서, 이 가격을 다시 넘는지가 중요하다'",
  "- 예: '최근 20일 평균(12,340원) 위에 있지만 너무 빨리 올라서, 약 8.2%쯤 빠지면 정리하는 기준을 잡아볼 수 있다'",
  "",
  "[말투 규칙]",
  "- 초등학생도 알아듣게 쓴다. 짧은 문장, 쉬운 단어.",
  "- '신규 진입', '분할 매수', '포지션', '이탈', '지지', '모멘텀' 같은 투자 전문 용어는 쓰지 않는다.",
  "- 대신 이렇게 바꾼다:",
  "  '신규 진입' -> '새로 사는 것'",
  "  '분할 매수' -> '나눠서 사는 것'",
  "  '이탈' -> '아래로 내려가면'",
  "  '지지' -> '버텨주면'",
  "  '포지션 힌트' -> 쓰지 않는다. 자연스러운 문장으로 풀어 쓴다.",
  "  '추세' -> '흐름'",
  "  '밴드 하단' -> '최근 가격 바닥 근처'",
  "  '손절' -> '손해를 끊는 것'",
  "- 각 문장 180자 이내.",
  "- 영어 약어(MA, RSI, ATR, BB 등) 절대 금지.",
  "- '~로 볼 수 있다', '~에 가깝다' 등 부드러운 표현을 쓴다.",
  "- 사라고/팔라고 확정 지시는 하지 않는다.",
  "",
  "[절대 금지]",
  "- X, XX 같은 자리표시자 출력 (반드시 수치 요약에 있는 실제 숫자를 넣는다)",
  "- 'null', '(null)', '데이터 없음', 'N/A', '이 화면에 없다' 출력",
  "- '확인이 필요하다', '다른 정보와 함께 보세요' 같은 떠넘기기",
  "- 교과서 정의 ('RSI가 OO이면 중립이다')",
  "- 데이터에 없는 숫자/등급 지어내기",
  "- BULLET: / TAKEAWAY: 줄 외에 다른 텍스트 출력",
].join("\n");

export type QuantOpinionSource = "gemini" | "unavailable";

export async function generateQuantOpinionKo(
  p: QuantOpinionRequestPayload
): Promise<{
  lines: string[];
  source: QuantOpinionSource;
  layout: QuantOpinionLayout;
}> {
  const packGemini = (lines: string[]) => ({
    lines,
    source: "gemini" as const,
    layout: buildQuantOpinionLayout(p, lines, "gemini"),
  });

  const packUnavailable = () => ({
    lines: [] as string[],
    source: "unavailable" as const,
    layout: emptyQuantOpinionLayout(),
  });

  const apiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[quant/ai-opinion] No GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_API_KEY -- AI comment skipped"
      );
    }
    return packUnavailable();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const user = buildUserMessage(p);

  for (const modelId of geminiModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: SYSTEM_HINT,
      });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 400,
        },
      });
      const text = result.response.text()?.trim() ?? "";
      const lines = parseOpinionLines(text).filter(Boolean);
      if (lines.length < 2) {
        continue;
      }
      return packGemini(lines.slice(0, 2));
    } catch (e) {
      if (isGeminiModelNotFoundError(e)) continue;
      if (process.env.NODE_ENV === "development") {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[quant/ai-opinion] Gemini failed model=${modelId}:`, msg);
      }
      return packUnavailable();
    }
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[quant/ai-opinion] All Gemini models skipped or returned fewer than 2 lines (check API key, model IDs, region/VPN)."
    );
  }
  return packUnavailable();
}
