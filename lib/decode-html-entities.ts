/**
 * RSS/API 등에서 온 문자열에 남는 기본 HTML 엔티티를 텍스트로 복원합니다.
 * (브라우저 innerHTML 없이 서버에서 안전하게 처리)
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
};

function fromCodePointDec(n: number): string | null {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return null;
  if (n >= 0xd800 && n <= 0xdfff) return null;
  return String.fromCodePoint(n);
}

export function decodeHtmlEntities(text: string): string {
  let cur = text;
  for (let i = 0; i < 8; i++) {
    const next = cur
      .replace(/&#x([0-9a-f]{1,6});/gi, (full, hex: string) => {
        const cp = fromCodePointDec(parseInt(hex, 16));
        return cp ?? full;
      })
      .replace(/&#(\d{1,7});/g, (full, dec: string) => {
        const cp = fromCodePointDec(parseInt(dec, 10));
        return cp ?? full;
      })
      .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (full, name: string) => {
        return NAMED[name.toLowerCase()] ?? full;
      });
    if (next === cur) break;
    cur = next;
  }
  return cur;
}
