/** scripts/article_news_score.py · 룩어헤드 없는 F 시그널 점수 페이로드 (0~100) */
export type NewsSignalScorePayload = {
  score_total: number;
  breakdown: {
    time_max15: number;
    ma20_max20: number;
    ret1d_max15: number;
    gap_max15: number;
    anchor_max25: number;
    bonus_max10: number;
  };
  flags: Record<string, boolean>;
};
