/**
 * 홈 피드 퀀트스코어 (Quant V2) — `data/home_feed_quant_scores.json`을 빌드에 고정(import 번들).
 * ML 모델(기술+이벤트+감성 피처 → 1일 양전 확률) 기반 0~99 점수(100 미표시).
 * 갱신: `npm run quant-v2-scores` → 커밋 → 재빌드/재시작.
 */

import raw from "../data/home_feed_quant_scores.json";
import { clampQuantV2ScorePoints } from "@/lib/quant-v2-score-cap";

type FileShape = {
  generated_at?: string | null;
  scores?: Record<string, number>;
};

const SCORES: Record<string, number> = (() => {
  const s = (raw as FileShape).scores;
  if (!s || typeof s !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clampQuantV2ScorePoints(v);
  }
  return out;
})();

/** article_id → 퀀트스코어(0~99, 1일 양전 확률 ML 모델), 스냅샷에 없으면 null */
export function getHomeFeedQuantScore(articleId: string): number | null {
  if (!articleId) return null;
  const v = SCORES[articleId];
  return v !== undefined ? v : null;
}
