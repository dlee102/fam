/**
 * 퀀트·펀더멘탈·AI 인사이트에 쓸 "기준 종목" 선택.
 * 기사 메타(뉴스 티커 리스트) 순서를 우선하고, EOD/5분 매니페스트에 실제 데이터가 있는 종목만 고른다.
 * (매니페스트 배열 순서의 [0]번은 기사 본문·레일 순서와 다를 수 있음)
 */
export function pickPrimaryQuantTicker(
  railOrderedCodes: string[],
  manifestTickers: string[]
): string | undefined {
  const set = new Set(manifestTickers);
  for (const raw of railOrderedCodes) {
    const s = String(raw).trim();
    if (/^\d{6}$/.test(s) && set.has(s)) return s;
  }
  return manifestTickers[0];
}
