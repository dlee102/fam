/**
 * `data/member_dashboard_top10.json` — 발행일 기준 5거래일 EOD 누적% 상위 10건.
 * 갱신: `npm run member-dashboard-top10`
 */
import { decodeHtmlEntities } from "@/lib/decode-html-entities";
import { sortMemberRankingsByCumRetDesc, type MemberRankingRow } from "@/lib/member-dashboard-data";
import raw from "@/data/member_dashboard_top10.json";

type FileShape = {
  generated_at?: string;
  sort?: string;
  limit?: number;
  rankings: MemberRankingRow[];
};

const file = raw as FileShape;

export function getMemberDashboardStatic(): {
  generated_at: string | undefined;
  rankings: MemberRankingRow[];
} {
  const limit = typeof file.limit === "number" && file.limit > 0 ? file.limit : 10;
  const rawRows = Array.isArray(file.rankings)
    ? file.rankings.map((r) => ({ ...r, title: decodeHtmlEntities(r.title) }))
    : [];
  /** JSON 저장 순서와 무관하게 누적 수익률 내림차순으로 다시 나열 */
  const rankings = sortMemberRankingsByCumRetDesc(rawRows).slice(0, limit);
  return {
    generated_at: file.generated_at,
    rankings,
  };
}
