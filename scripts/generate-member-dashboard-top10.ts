/**
 * EODHD 일봉: 발행일(t0) 종가→5거래일 후 종가 누적% 풀에서 상위 10건 JSON 저장.
 * 실행: npm run member-dashboard-top10
 *
 * 풀을 키우려면 maxArticles / maxPairs 만 조정 (부하↑).
 */

import fs from "fs";
import path from "path";
import {
  loadMemberDashboardData,
  sortMemberRankingsByCumRetDesc,
} from "../lib/member-dashboard-data";

const OUT = path.join(process.cwd(), "data", "member_dashboard_top10.json");

async function main() {
  const { rankings } = await loadMemberDashboardData({
    maxArticles: 120,
    maxPairs: 72,
    parallel: 14,
  });

  const sorted = sortMemberRankingsByCumRetDesc(rankings);
  const top = sorted.slice(0, 10);

  const payload = {
    generated_at: new Date().toISOString(),
    sort: "cum_ret_pct_desc",
    limit: 10,
    pool_size: rankings.length,
    rankings: top,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Pool ${rankings.length} rows → top 10 by 5일 누적%. → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
