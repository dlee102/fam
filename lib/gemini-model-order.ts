/**
 * Gemini 모델 ID: 신규 API 키에서 404 나는 구형 ID 피하고, 실패 시 순차 폴백.
 * (scripts/news_sentiment_gemini.py 의 flash-lite → 2.5-flash 순서와 맞춤)
 */

export const GEMINI_MODEL_DEFAULT = "gemini-2.5-flash-lite";

export const GEMINI_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-3-flash-preview",
] as const;

/** GEMINI_MODEL 이 있으면 맨 앞에 한 번만 넣고, 이어서 폴백 체인 */
export function geminiModelCandidates(): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of [env, ...GEMINI_MODEL_FALLBACK_CHAIN]) {
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

export function isGeminiModelNotFoundError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const u = msg.toUpperCase();
  return (
    u.includes("404") ||
    u.includes("NOT FOUND") ||
    u.includes("NOT AVAILABLE TO NEW USERS") ||
    u.includes("NO LONGER AVAILABLE")
  );
}
