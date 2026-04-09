"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemberRankingRow } from "@/lib/member-dashboard-data";
import {
  extractKoreaTickerFromInput,
  normalizeKoreaTickerList,
  parseStoredTickerArrayJson,
  persistTickerArrayJson,
} from "@/lib/korea-ticker";
import { FAM_MEMBER_WATCHLIST_V1 } from "@/lib/member-storage-keys";

type SortKey = "recent" | "score" | "performance";

function sortRankings(rows: MemberRankingRow[], key: SortKey): MemberRankingRow[] {
  const copy = [...rows];
  if (key === "recent") {
    copy.sort(
      (a, b) =>
        Date.parse(b.published_at.replace(" ", "T")) -
        Date.parse(a.published_at.replace(" ", "T"))
    );
  } else if (key === "score") {
    copy.sort((a, b) => b.score_total - a.score_total);
  } else {
    copy.sort((a, b) => {
      const av = a.cum_ret_pct;
      const bv = b.cum_ret_pct;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });
  }
  return copy;
}

export function MemberDashboardClient({
  rankings,
  snapshotAt,
}: {
  rankings: MemberRankingRow[];
  /** JSON 스냅샷 생성 시각 (ISO), 없으면 미표시 */
  snapshotAt?: string | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("performance");
  const [watchInput, setWatchInput] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>([]);

  const persistWatchlist = useCallback((next: string[]) => {
    setWatchlist(next);
    persistTickerArrayJson(FAM_MEMBER_WATCHLIST_V1, next);
  }, []);

  useEffect(() => {
    setWatchlist(parseStoredTickerArrayJson(localStorage.getItem(FAM_MEMBER_WATCHLIST_V1)));
  }, []);

  const sorted = useMemo(() => sortRankings(rankings, sortKey), [rankings, sortKey]);

  const watchMatches = useMemo(() => {
    if (watchlist.length === 0) return [];
    const set = new Set(watchlist);
    return sorted.filter((r) => set.has(r.ticker));
  }, [sorted, watchlist]);

  const addTicker = () => {
    const t = extractKoreaTickerFromInput(watchInput);
    if (!t) return;
    if (watchlist.includes(t)) {
      setWatchInput("");
      return;
    }
    persistWatchlist(normalizeKoreaTickerList([...watchlist, t], { sort: true }));
    setWatchInput("");
  };

  const removeTicker = (t: string) => {
    persistWatchlist(watchlist.filter((x) => x !== t));
  };

  const fmtPct = (v: number | null) =>
    v == null || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  return (
    <>
      <header className="member-dashboard__hero">
        <span className="member-dashboard__badge">유료 회원 전용</span>
        <h1 className="member-dashboard__title">유료회원 전용 대시보드</h1>
        {snapshotAt ? (
          <p className="member-dashboard__meta" style={{ marginTop: "0.35rem" }}>
            스냅샷: {snapshotAt}
          </p>
        ) : null}
      </header>

      <div className="member-dashboard__grid">
        <section className="member-dashboard__card" aria-labelledby="rank-heading">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.5rem",
              marginBottom: "0.65rem",
            }}
          >
            <h2 id="rank-heading" style={{ margin: 0 }}>
              기사·종목 AI 퀀트 점수 · 발행 후 5거래일 누적 랭킹
            </h2>
            <label className="member-dashboard__sort-label">
              <span className="member-dashboard__sort-sr">정렬</span>
              <select
                className="member-dashboard__select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="performance">5거래일 누적 (내림차순)</option>
                <option value="score">AI 퀀트 점수 (내림차순)</option>
                <option value="recent">최신 기사순</option>
              </select>
            </label>
          </div>
          {rankings.length === 0 ? (
            <p className="member-dashboard__empty">
              집계할 데이터가 없습니다. SomedayNews와 EOD 매니페스트에 연결된 기사가 필요합니다.
            </p>
          ) : (
            <div className="member-dashboard__table-wrap">
              <table className="member-dashboard__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>기사</th>
                    <th>종목</th>
                    <th>AI 퀀트 점수</th>
                    <th>등급</th>
                    <th>5거래일 누적</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={`${r.article_id}-${r.ticker}`}>
                      <td>{i + 1}</td>
                      <td>
                        <Link
                          href={`/article/${encodeURIComponent(r.article_id)}`}
                          className="member-dashboard__article-link"
                          title={r.title}
                        >
                          {r.title.length > 56 ? `${r.title.slice(0, 56)}…` : r.title}
                        </Link>
                        <div className="member-dashboard__meta">
                          {r.published_at.slice(0, 16)} · 5m→일
                        </div>
                      </td>
                      <td>
                        <span className="member-dashboard__ticker">{r.ticker}</span>
                        <div className="member-dashboard__meta">{r.ticker_name}</div>
                      </td>
                      <td>{r.score_total}</td>
                      <td>{r.grade}</td>
                      <td
                        style={{
                          color:
                            r.cum_ret_pct == null
                              ? undefined
                              : r.cum_ret_pct >= 0
                                ? "var(--quant-up)"
                                : "var(--quant-down)",
                        }}
                      >
                        {fmtPct(r.cum_ret_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="member-dashboard__card" aria-labelledby="watch-heading">
          <h2 id="watch-heading" style={{ margin: "0 0 0.65rem" }}>
            관심종목 추적
          </h2>
          <p className="member-dashboard__empty" style={{ marginBottom: "0.75rem" }}>
            6자리 종목코드를 추가하면 아래 표에서 해당 종목이 포함된 기사 행만 모아 봅니다. 데이터는 브라우저{" "}
            <code className="member-dashboard__code">localStorage</code>에 저장됩니다.
          </p>
          <div className="member-dashboard__watch-add">
            <input
              className="member-dashboard__input"
              inputMode="numeric"
              maxLength={6}
              placeholder="예: 005930"
              value={watchInput}
              onChange={(e) => setWatchInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && addTicker()}
            />
            <button type="button" className="member-dashboard__btn" onClick={addTicker}>
              추가
            </button>
          </div>
          {watchlist.length > 0 ? (
            <ul className="member-dashboard__chips">
              {watchlist.map((t) => (
                <li key={t} className="member-dashboard__chip">
                  <span>{t}</span>
                  <button type="button" className="member-dashboard__chip-x" onClick={() => removeTicker(t)} aria-label={`${t} 제거`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <h3 className="member-dashboard__h3">내 관심 종목이 포함된 기사</h3>
          {watchlist.length === 0 ? (
            <p className="member-dashboard__empty" style={{ margin: 0 }}>
              관심 종목을 추가하면 랭킹에서 해당 티커만 필터됩니다.
            </p>
          ) : watchMatches.length === 0 ? (
            <p className="member-dashboard__empty" style={{ margin: 0 }}>
              현재 집계 구간에 관심 종목이 포함된 기사가 없습니다.
            </p>
          ) : (
            <div className="member-dashboard__table-wrap">
              <table className="member-dashboard__table">
                <thead>
                  <tr>
                    <th>기사</th>
                    <th>종목</th>
                    <th>AI 퀀트 점수</th>
                    <th>5거래일 누적</th>
                  </tr>
                </thead>
                <tbody>
                  {watchMatches.map((r) => (
                    <tr key={`w-${r.article_id}-${r.ticker}`}>
                      <td>
                        <Link
                          href={`/article/${encodeURIComponent(r.article_id)}`}
                          className="member-dashboard__article-link"
                        >
                          {r.title.length > 40 ? `${r.title.slice(0, 40)}…` : r.title}
                        </Link>
                      </td>
                      <td>{r.ticker}</td>
                      <td>{r.score_total}</td>
                      <td>{fmtPct(r.cum_ret_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
