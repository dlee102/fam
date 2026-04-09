/** 한국 거래소 6자리 종목코드 */

export const KOREA_TICKER_CODE_RE = /^\d{6}$/;

export function isKoreaTickerCode(s: string): boolean {
  return KOREA_TICKER_CODE_RE.test(s);
}

export type NormalizeTickerOptions = {
  /** 최대 개수 (포트폴리오 등) */
  maxCount?: number;
  /** true면 오름차순 정렬 (관심종목 등) */
  sort?: boolean;
};

/**
 * 문자열 목록에서 유효한 6자리 코드만 고유·순서 유지로 추출.
 */
export function normalizeKoreaTickerList(
  codes: Iterable<string>,
  opts?: NormalizeTickerOptions
): string[] {
  const max = opts?.maxCount ?? Infinity;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const s = String(c).trim();
    if (!isKoreaTickerCode(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  if (opts?.sort) out.sort();
  return out;
}

/** 입력 필드에서 숫자만 남겨 6자리 후보 추출 */
export function extractKoreaTickerFromInput(raw: string): string | null {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  return d.length === 6 ? d : null;
}

/** localStorage JSON 배열 `["005930", ...]` 파싱 */
export function parseStoredTickerArrayJson(raw: string | null, maxCount?: number): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return normalizeKoreaTickerList(v.map(String), { maxCount });
  } catch {
    return [];
  }
}

export function persistTickerArrayJson(storageKey: string, tickers: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tickers));
  } catch {
    /* ignore */
  }
}
