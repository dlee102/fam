import type { ArticleBioPeerMapModel, BioPeerValuationInsight } from "@/lib/bio-business-peer-data";

const TAG_COLORS: Record<string, string> = {
  up: "var(--quant-up, #15803d)",
  down: "var(--quant-down, #b91c1c)",
  neutral: "var(--color-text-muted, #737373)",
};

function PeerInsightCard({ insight }: { insight: BioPeerValuationInsight }) {
  return (
    <div className="article-bio-peer__insight-card">
      <div className="article-bio-peer__insight-header">
        <span className="article-bio-peer__insight-name">{insight.name}</span>
        <span className="article-bio-peer__insight-pos">
          {insight.typeShort} {insight.cohortTotal}개 중 {insight.cohortRank}위
        </span>
      </div>

      <table className="article-bio-peer__insight-table" aria-label="동종 비교">
        <thead>
          <tr>
            <th className="article-bio-peer__insight-th" />
            <th className="article-bio-peer__insight-th article-bio-peer__insight-th--val">이 종목</th>
            <th className="article-bio-peer__insight-th article-bio-peer__insight-th--val">동종 중간</th>
            <th className="article-bio-peer__insight-th" />
          </tr>
        </thead>
        <tbody>
          {insight.comparisons.map((c) => (
            <tr key={c.label} className="article-bio-peer__insight-tr">
              <td className="article-bio-peer__insight-td article-bio-peer__insight-td--label">{c.label}</td>
              <td className="article-bio-peer__insight-td article-bio-peer__insight-td--val">{c.tickerValue ?? "—"}</td>
              <td className="article-bio-peer__insight-td article-bio-peer__insight-td--val article-bio-peer__insight-td--median">
                {c.peerMedian ?? "—"}
              </td>
              <td className="article-bio-peer__insight-td article-bio-peer__insight-td--tag">
                {c.tag ? (
                  <span
                    className="article-bio-peer__insight-tag"
                    style={{ color: TAG_COLORS[c.tagColor] }}
                  >
                    {c.tag}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="article-bio-peer__insight-line">{insight.insightLine}</p>
    </div>
  );
}

export function ArticleBioPeerMap({ model }: { model: ArticleBioPeerMapModel }) {
  const { rows, distribution, peerGroups, peerInsights } = model;
  const total = rows.length;

  return (
    <aside className="article-bio-peer" aria-label="사업 유형 동류">
      <div className="article-bio-peer__panel">
        <p className="article-bio-peer__heading">동류 사업 유형</p>
        <p className="article-bio-peer__sub">
          같은 묶음 비율 · 유사 표본. 순위는 동종 풀 안에서 1위가 가장 앞선 값(시총 있으면 시총 우선).
        </p>

        <ul className="article-bio-peer__chips" aria-label="이 기사 종목별 유형">
          {rows.map((r) => (
            <li key={r.code} className="article-bio-peer__chip" title={r.typeLabel}>
              <span className="article-bio-peer__chip-dot" style={{ background: r.color }} />
              <span className="article-bio-peer__chip-name">{r.name}</span>
              <span className="article-bio-peer__chip-meta">
                <span className="article-bio-peer__chip-code">{r.code}</span>
                <span className="article-bio-peer__chip-type">{r.typeShort}</span>
              </span>
              <p className="article-bio-peer__chip-rank">
                <span className="article-bio-peer__chip-rank-main">
                  동종 {r.cohortTotal}개 중 <strong>{r.cohortRank}위</strong>
                </span>
                <span className="article-bio-peer__chip-rank-basis">
                  {r.rankBasis === "mcap" ? "시총 순" : "분류 신뢰도 순"}
                </span>
              </p>
            </li>
          ))}
        </ul>

        {peerInsights.length > 0 ? (
          <div className="article-bio-peer__insights" aria-label="동종 비교 인사이트">
            <p className="article-bio-peer__insights-kicker">동종 비교 인사이트</p>
            {peerInsights.map((ins) => (
              <PeerInsightCard key={ins.code} insight={ins} />
            ))}
          </div>
        ) : null}

        {distribution.length > 0 ? (
          <>
            <div
              className="article-bio-peer__bar"
              role="img"
              aria-label={`기사 종목 ${total}개 중 유형별 비중`}
            >
              {distribution.map((s) => (
                <span
                  key={s.typeId}
                  className="article-bio-peer__bar-seg"
                  style={{
                    flexGrow: s.count,
                    background: s.color,
                  }}
                  title={`${s.typeLabel} ${s.count}/${total}`}
                />
              ))}
            </div>
            <ul className="article-bio-peer__legend">
              {distribution.map((s) => (
                <li key={s.typeId} className="article-bio-peer__legend-item">
                  <span className="article-bio-peer__legend-swatch" style={{ background: s.color }} />
                  <span className="article-bio-peer__legend-text">
                    {s.typeShort}
                    <span className="article-bio-peer__legend-count">{s.count}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {peerGroups.length > 0 ? (
          <div className="article-bio-peer__peers">
            {peerGroups.map((g) => (
              <div key={g.typeId} className="article-bio-peer__peer-block">
                <div className="article-bio-peer__peer-head">
                  <span className="article-bio-peer__peer-dot" style={{ background: g.color }} />
                  <span className="article-bio-peer__peer-title">{g.typeShort} 유사</span>
                </div>
                <div className="article-bio-peer__peer-tags" aria-label={`${g.typeLabel} 유사 종목`}>
                  {g.peers.map((p) => (
                    <span key={p.code} className="article-bio-peer__tag" title={`${p.name} (${p.code})`}>
                      <span className="article-bio-peer__tag-name">{p.name}</span>
                      <span className="article-bio-peer__tag-code">{p.code}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="article-bio-peer__empty-peers">같은 유형 표본 종목이 없거나 데이터가 부족합니다.</p>
        )}

        <p className="article-bio-peer__foot">자동 분류 · 참고용</p>
      </div>
    </aside>
  );
}
