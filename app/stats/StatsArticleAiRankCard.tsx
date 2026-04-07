import fs from "fs";
import path from "path";

export type ArticleAiRankDemo = {
  note?: string;
  source_generated_at?: string;
  rows: Array<{
    rank: number;
    ticker: string;
    name: string;
    title: string;
    ai_score: number;
    ret_t10_pct: number;
    t0_date: string;
    pattern_group: string;
  }>;
};

/** 기사 공개 후 수익률 표시 범위 (데모·UI 정책) */
export function clampPublishReturnPct(v: number): number {
  return Math.min(29, Math.max(5, v));
}

function loadDemo(): ArticleAiRankDemo | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "article_ai_rank_demo.json"), "utf-8");
    return JSON.parse(raw) as ArticleAiRankDemo;
  } catch {
    return null;
  }
}

const cardShell = {
  borderRadius: "8px",
  border: "1px solid var(--stats-card-border)",
  background: "var(--stats-card-bg)",
  padding: "22px 22px 18px",
  marginBottom: "40px",
} as const;

type Props = {
  /** 기사 퀀트 대시보드(quant-dash-cell) 안에 넣을 때: 바깥 카드 래퍼 생략 */
  embedded?: boolean;
};

export function StatsArticleAiRankCard({ embedded = false }: Props) {
  const data = loadDemo();
  if (!data?.rows?.length) return null;

  const titleId = embedded ? "article-ai-rank-title" : "stats-ai-rank-title";

  const body = (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "8px 16px",
          marginBottom: "14px",
        }}
      >
        <h2
          id={titleId}
          style={{
            fontSize: embedded ? "1.05rem" : "17px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "var(--color-text)",
          }}
        >
          기사·종목 AI 점수 및 성과 랭킹
        </h2>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            color: "var(--stats-badge-fg)",
            backgroundColor: "var(--stats-badge-bg)",
            padding: "4px 10px",
            borderRadius: "999px",
          }}
        >
          실시간 제공 · 데모
        </span>
      </div>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: embedded ? "0.75rem" : "13px",
          lineHeight: 1.55,
          color: "var(--color-text-muted)",
        }}
      >
        기사 공개 이후 수익률(T+10 거래일, T0 종가 진입 가정)은 <strong>5%~29%</strong> 구간으로 표시합니다. AI 종합 점수와 함께 봅니다.
        아래 표는 집계 파이프라인 사례를 발췌한 <strong>UI 시연용</strong>입니다.
      </p>
      <div
        style={{
          overflowX: "auto",
          borderRadius: "6px",
          border: "1px solid var(--color-border-subtle)",
          backgroundColor: "var(--color-elevated)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            fontSize: embedded ? "0.72rem" : "13px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "var(--quant-canvas)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontWeight: 600,
                  color: "var(--quant-label)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                순위
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontWeight: 600,
                  color: "var(--quant-label)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                종목
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontWeight: 600,
                  color: "var(--quant-label)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                기사 제목
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "10px 12px",
                  fontWeight: 600,
                  color: "var(--quant-label)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  whiteSpace: "nowrap",
                }}
              >
                AI 점수
              </th>
              <th
                title="기사 공개일(T0) 종가 진입 → T+10 거래일 종가 기준 누적 수익률"
                style={{
                  textAlign: "right",
                  padding: "10px 12px",
                  fontWeight: 600,
                  color: "var(--quant-label)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  whiteSpace: "nowrap",
                }}
              >
                공개 후 수익률 (T+10)
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const pubRet = clampPublishReturnPct(r.ret_t10_pct);
              return (
                <tr key={`${r.ticker}-${r.rank}-${r.t0_date}`}>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--quant-grid)",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {r.rank}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--quant-grid)",
                      fontWeight: 600,
                      color: "var(--color-text)",
                    }}
                  >
                    {r.name}
                    <span
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "var(--color-text-faint)",
                      }}
                    >
                      {r.ticker}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--quant-grid)",
                      color: "var(--quant-label)",
                      maxWidth: "320px",
                      lineHeight: 1.45,
                    }}
                  >
                    <span title={r.title}>{r.title.length > 56 ? `${r.title.slice(0, 56)}…` : r.title}</span>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--quant-grid)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums" as const,
                      fontWeight: 600,
                      color: "var(--stats-ai-score)",
                    }}
                  >
                    {r.ai_score}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--quant-grid)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums" as const,
                      fontWeight: 600,
                      color: pubRet >= 0 ? "var(--stats-kr-up)" : "var(--stats-kr-down)",
                    }}
                  >
                    {pubRet >= 0 ? "+" : ""}
                    {pubRet}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p
        style={{
          margin: "12px 0 0",
          fontSize: embedded ? "0.625rem" : "11px",
          color: "var(--color-text-faint)",
          lineHeight: 1.5,
        }}
      >
        {data.note}
        {data.source_generated_at ? ` · 원본 집계 시각: ${data.source_generated_at}` : null}
      </p>
    </>
  );

  if (embedded) {
    return (
      <section style={{ margin: 0, padding: 0, border: "none" }} aria-labelledby={titleId}>
        {body}
      </section>
    );
  }

  return (
    <section style={cardShell} aria-labelledby={titleId}>
      {body}
    </section>
  );
}
