import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  geminiModelCandidates,
  isGeminiModelNotFoundError,
} from "@/lib/gemini-model-order";
import {
  buildQuantOpinionLayout,
  isQuantOpinionPayload,
  templateQuantOpinionKo,
  type QuantOpinionLayout,
  type QuantOpinionRequestPayload,
} from "@/lib/quant-opinion-shared";

export type { QuantOpinionLayout, QuantOpinionRequestPayload } from "@/lib/quant-opinion-shared";
export {
  buildQuantOpinionLayout,
  isQuantOpinionPayload,
  templateQuantOpinionKo,
} from "@/lib/quant-opinion-shared";

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

  const parts: string[] = [];
  parts.push("[기사]");
  if (article_title?.trim()) parts.push(`제목: ${article_title.trim()}`);
  if (article_excerpt?.trim()) {
    parts.push(`본문 발췌:\n${article_excerpt.trim()}`);
  } else {
    parts.push(
      "본문 발췌: (이 화면에 본문이 없음 — 제목·아래 퀀트·분류만으로 제한적으로 작성할 것)"
    );
  }
  if (sentiment_label_ko?.trim() || article_primary_type_ko?.trim() || catalyst_label_ko?.trim()) {
    parts.push("[기사 분류·메타(참고, 추측 금지)]");
    if (sentiment_label_ko?.trim()) parts.push(`톤: ${sentiment_label_ko.trim()}`);
    if (article_primary_type_ko?.trim()) parts.push(`유형: ${article_primary_type_ko.trim()}`);
    if (catalyst_label_ko?.trim()) parts.push(`촉매 태그: ${catalyst_label_ko.trim()}`);
  }
  parts.push("[퀀트 지표·엔진 요약 JSON]");
  parts.push(JSON.stringify(quantCore));

  const stmtN = fundamentals_snapshot?.statement_highlights?.length ?? 0;
  if (
    fundamentals_snapshot &&
    fundamentals_snapshot.data_quality !== "missing" &&
    (Object.keys(fundamentals_snapshot.metrics).length > 0 ||
      fundamentals_snapshot.company_name ||
      stmtN > 0)
  ) {
    parts.push(
      "[펀더멘탈 요약(Yahoo Finance 스냅샷, 참고·지연·누락 가능 — JSON에 없는 해석·수치 금지)]"
    );
    parts.push(
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

  const instruction = [
    "위 [기사]·[퀀트 JSON]·(있으면)[펀더멘탈 JSON]을 함께 읽고, 초급 투자자용으로 정확히 2문장을 써 줘.",
    "",
    "[1번 문장] 기사의 핵심 흐름·이슈를 퀀트 기술 지표(등급·방향·거래 흐름)와 연결해 설명한다.",
    "[2번 문장 — 한 줄 정리] 반드시 ① 기사 내용 핵심(호재/리스크/사건) → ② 퀀트 기술 지표 흐름 → ③ 펀더멘탈 체력(있을 때만) → ④ 지금 포지션 힌트 순서로 한 문장 안에 자연스럽게 이어 담는다.",
    "④ 포지션 힌트 규칙(반드시 준수):",
    "  - JSON의 indicators.ma20(20일 평균가), indicators.bb_lower(밴드 하단가), entry.stop_loss_pct(손절 기준%)를 직접 읽어 수치로 언급한다.",
    "  - 예: '20일 평균(XX,XXX원) 위를 유지하면 분할 진입 고려, 이탈 시 손절 기준(X.X%) 참고', '밴드 하단(XX,XXX원) 부근에서 반등 여부가 관건이며 지금은 추격보다 눌림 대기', '손절 기준(X.X%) 감안 시 현 가격대 신규 진입은 부담, 관망이 나음'.",
    "  - 수치가 null이면 그 항목은 생략하되, 나머지 수치로라도 구체적인 기준을 제시한다.",
    "  - '지지선 확인이 필요하다', '추가 확인 필요', '다른 정보와 함께 보세요', '종합적으로 살펴보세요' 같이 독자한테 판단을 떠넘기는 표현은 절대 금지.",
    "  - 확정 매수·매도 지시는 금지하되, 수치 기반의 구체적 행동 기준은 반드시 제시한다.",
  ].join("\n");

  return `${instruction}\n\n${parts.join("\n\n")}`;
}

function parseOpinionLines(text: string): string[] {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")   // Gemini가 리터럴 \n 두 글자로 출력한 경우 대비
    .replace(/\*\*/g, "")
    .replace(/^[\s\-*•]+/gm, "")
    .trim();
  const raw = cleaned.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (raw.length >= 2) return raw.slice(0, 2);
  if (raw.length === 1) {
    const one = raw[0];
    const byPeriod = one
      .split(/(?<=[.!?。])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (byPeriod.length >= 2) return byPeriod.slice(0, 2);
  }
  return raw.length ? [raw[0], raw[0]] : [];
}

const SYSTEM_HINT = `역할: 한국어 금융 퀀트 코멘트 작성자(초급·입문 독자용).
도메인 전제(반드시 지킬 것):
- 다루는 종목은 주로 국내 바이오·제약·바이오 연관 상장사다. 삼성전자·대형 지수주 같은 초대형 블루칩 전제의 비유·표현·기대수익 톤은 쓰지 않는다.
- 시총·유동성이 상대적으로 작고, 뉴스·임상·규제 이벤트에 주가 반응이 큰 편이라는 점을 염두에 두되, 기사·JSON에 없는 구체 사실(임상 단계명·FDA 승인 여부 등)은 지어내지 않는다.
- "대형주처럼 안정적이다" 같은 서술은 금지. 변동·거래량 이슈를 말할 때는 중소형 성장주 맥락으로 완곡하게만 짚는다.

반드시 할 것(기사+퀀트 결합):
- 본문 발췌가 있으면: 그 안의 주제·갈등·호재/리스크 흐름을 최소 한 번 이상 짚고, 그와 동시에 퀀트 JSON의 등급·핵심 패턴·요약 문장과 연결해 설명한다. 지표 숫자만 읊는 답변은 실패다.
- 본문 발췌가 없으면: 제목·분류 메타·퀀트만으로 할 수 있는 범위에서만 쓰고, 없는 내용은 상상하지 않는다.
- 펀더멘탈 JSON이 붙어 있으면: 그 안의 metrics·회사명·섹터만 근거로, 퀀트(차트) 해석과 한 번만 짧게 연결한다(예: 밸류에이션·재무 체력이 차트와 같이/다르게 보일 수 있음). 펀더멘탈에 없는 재무 항목·정확한 공시 수치는 쓰지 않는다.

절대 금지:
- "상대강도지수·RSI가 OO이면 중립이다", "볼린저 밴드는 …"처럼 교과서·정의만 반복하는 문장.
- 퀀트 JSON에 없는 수치·등급·시그널을 지어내기.
- 펀더멘탈 JSON에 없는 재무 비율·시총·성장률을 지어내기.

규칙:
- 정확히 2문장만 출력한다. 각 문장은 별도 줄에 출력한다(두 줄 출력).
- 2번 문장(한 줄 정리)은 반드시 ① 기사 내용 → ② 퀀트 기술 지표 → ③ 펀더멘탈(있을 때만) → ④ 포지션 힌트 순서를 한 문장 안에 자연스럽게 이어 담는다.
- ④ 포지션 힌트는 JSON의 indicators.ma20(20일 평균가), indicators.bb_lower(밴드 하단가), entry.stop_loss_pct(손절 기준%)를 직접 읽어 수치로 언급한다. 예: '20일 평균(XX,XXX원) 위 유지 시 분할 진입, 손절 기준(X.X%) 참고', '밴드 하단(XX,XXX원)이 지지선 역할, 이탈 전까진 눌림 대기 유효'. '지지선 확인이 필요하다', '추가 확인 필요', '다른 정보와 함께 보세요', '종합적으로 살펴보세요' 같이 독자한테 판단을 떠넘기는 표현은 절대 금지. 수치가 null이면 생략하되 다른 수치로 대체. 확정 매수·매도 지시 절대 금지.
- MA, RSI, Squeeze 같은 영어·전문 약어는 쓰지 않거나 반드시 쉬운 한국어로 풀어쓴다(다만 위 ‘교과서 정의’ 금지와 별개로, 필요하면 한 번만 짧게).
- 초등~중학생도 이해할 수 있는 짧고 쉬운 말을 쓴다.
- 개인 투자 권유·확정 매수/매도 지시 금지. "~로 해석할 수 있다", "~에 가깝다" 등 완곡 표현을 쓴다.
- 각 문장은 대략 180자 이내.
- 답변에 ‘바이오’·‘제약’ 같은 업종 단어를 굳이 쓰지 않아도 된다.`;

export async function generateQuantOpinionKo(
  p: QuantOpinionRequestPayload
): Promise<{
  lines: string[];
  source: "gemini" | "template";
  layout: QuantOpinionLayout;
}> {
  const pack = (
    lines: string[],
    source: "gemini" | "template"
  ): {
    lines: string[];
    source: "gemini" | "template";
    layout: QuantOpinionLayout;
  } => ({
    lines,
    source,
    layout: buildQuantOpinionLayout(p, lines, source),
  });

  const apiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return pack(templateQuantOpinionKo(p), "template");
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
        return pack(templateQuantOpinionKo(p), "template");
      }
      return pack(lines.slice(0, 2), "gemini");
    } catch (e) {
      if (isGeminiModelNotFoundError(e)) continue;
      return pack(templateQuantOpinionKo(p), "template");
    }
  }
  return pack(templateQuantOpinionKo(p), "template");
}
