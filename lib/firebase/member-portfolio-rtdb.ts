import { normalizeKoreaTickerList } from "@/lib/korea-ticker";

/**
 * 유료 포트폴리오 — Realtime Database 동기화
 *
 * RTDB 규칙 예시 (콘솔에서 배포):
 * {
 *   "rules": {
 *     "fam_member_portfolio": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 * 운영 환경에서는 인증 조건으로 좁히는 것을 권장합니다.
 */

export const MAX_MEMBER_PORTFOLIO_TICKERS = 64;

/** RTDB 노드 경로 (슬래시 없이). `NEXT_PUBLIC_FIREBASE_MEMBER_PORTFOLIO_PATH`로 재정의 가능 */
export function getMemberPortfolioRtdbPath(): string {
  const p = process.env.NEXT_PUBLIC_FIREBASE_MEMBER_PORTFOLIO_PATH?.trim();
  if (p) return p.replace(/^\/+|\/+$/g, "");
  return "fam_member_portfolio";
}

/**
 * RTDB에 배열로 쓴 값은 `{ "0": "005930", "1": "000660" }` 형태로 돌아올 수 있음.
 */
export function portfolioTickersFromRtdbVal(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return normalizeKoreaTickerList(raw.map(String), { maxCount: MAX_MEMBER_PORTFOLIO_TICKERS });
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    return normalizeKoreaTickerList(
      keys.map((k) => String(o[k])),
      { maxCount: MAX_MEMBER_PORTFOLIO_TICKERS }
    );
  }
  return [];
}
