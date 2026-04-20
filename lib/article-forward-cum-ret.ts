/**
 * 기사 매니페스트 EOD 일봉 누적 수익률.
 *
 * 앵커: 발행일(t0_kst) **직전 거래일(D-1) 종가**.
 *  - D-1 종가를 기준으로 삼아야 "뉴스 발행 전 가격 대비" 실제 영향을 온전히 잡을 수 있음.
 *  - T0 종가를 앵커로 쓰면 발행 당일 장중 급락/급등이 이미 반영된 뒤를 기준으로
 *    삼아 다음날 수치가 왜곡된다 (예: 당일 -28% 하락 후 다음날 +30% 반등 → +30%로만 표시).
 *  - 학습 데이터(build_quant_v2_dataset.py)도 동일하게 D-1 종가를 anchor로 사용.
 *
 * 수익률 = (T0+N 종가 / D-1 종가) − 1  (N ≥ 1 거래일)
 */

import { loadEodBars } from "@/lib/quant-engine/eod-loader";

export async function cumRetForwardTradingDaysFromPublish(
  articleId: string,
  ticker: string,
  forwardTradingDays: number
): Promise<number | null> {
  if (forwardTradingDays < 1) return null;
  const loaded = await loadEodBars(articleId, ticker);
  if (!loaded?.t0_kst || !loaded.bars.length) return null;
  const bars = [...loaded.bars].sort((a, b) => a.date.localeCompare(b.date));
  const i0 = bars.findIndex((b) => b.date >= loaded.t0_kst!);
  if (i0 < 1) return null;               // D-1 봉이 없으면 산출 불가
  const iEnd = i0 + forwardTradingDays;
  if (iEnd >= bars.length) return null;
  const c0 = bars[i0 - 1]!.close;        // ← D-1 종가를 앵커로
  const cEnd = bars[iEnd]!.close;
  if (!Number.isFinite(c0) || c0 <= 0 || !Number.isFinite(cEnd) || cEnd <= 0) return null;
  return ((cEnd / c0) - 1) * 100;
}

/**
 * 동일 EOD 로드 1회로 D-1 종가 대비 1·3거래일 후 누적 수익률(%).
 */
export async function cumRet1dAnd3dFromPublish(
  articleId: string,
  ticker: string
): Promise<{ cum_ret_1d_pct: number | null; cum_ret_3d_pct: number | null }> {
  const loaded = await loadEodBars(articleId, ticker);
  if (!loaded?.t0_kst || !loaded.bars.length) {
    return { cum_ret_1d_pct: null, cum_ret_3d_pct: null };
  }
  const bars = [...loaded.bars].sort((a, b) => a.date.localeCompare(b.date));
  const i0 = bars.findIndex((b) => b.date >= loaded.t0_kst!);
  if (i0 < 1) return { cum_ret_1d_pct: null, cum_ret_3d_pct: null }; // D-1 봉 필요
  const c0 = bars[i0 - 1]!.close;        // ← D-1 종가를 앵커로
  if (!Number.isFinite(c0) || c0 <= 0) {
    return { cum_ret_1d_pct: null, cum_ret_3d_pct: null };
  }

  const pct = (forwardTradingDays: number): number | null => {
    const iEnd = i0 + forwardTradingDays;
    if (iEnd >= bars.length) return null;
    const cEnd = bars[iEnd]!.close;
    if (!Number.isFinite(cEnd) || cEnd <= 0) return null;
    return ((cEnd / c0) - 1) * 100;
  };

  return {
    cum_ret_1d_pct: pct(1),
    cum_ret_3d_pct: pct(3),
  };
}
