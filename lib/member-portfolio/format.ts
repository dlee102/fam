/** 포트폴리오 표·CSV 공통 포맷 */

export function fmtPriceKo(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function fmtVolumeKo(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}

export type SignedCss = "" | "up" | "down";

export function signFromNumber(n: number): SignedCss {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "";
}
