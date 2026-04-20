import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  enrichHomeFeedWith3dCumRet,
  sortHomeFeedBy1dReturnDesc,
  splitHomeFeedBy1dReturnHalf,
  type HomeFeedArticleRow,
} from "@/lib/home-feed-cum-ret-3d";
import { HOME_FEED_EXCLUDED_ARTICLE_IDS } from "@/lib/home-feed-excluded-article-ids";
import { clampQuantV2ScorePoints } from "@/lib/quant-v2-score-cap";
import {
  getSomedayNewsFeedDebugSnapshot,
  getSomedayNewsList,
  type SomedayNewsFeedDebugSnapshot,
} from "@/lib/somedaynews-articles";
import { formatTickerListForDisplay, replaceTickerCodesWithNames } from "@/lib/ticker-names";

const LIST_LIMIT = 150;

function formatCumRetPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatQuantScore(n: number): string {
  return `${clampQuantV2ScorePoints(n)}`;
}

function feedArticleItems(rows: HomeFeedArticleRow[], withBottomRule: boolean) {
  return rows.map((article, i) => (
    <li
      key={article.article_id}
      className={`feed__item${withBottomRule && i < rows.length - 1 ? " feed__item--rule" : ""}`}
    >
      <Link href={`/article/${encodeURIComponent(article.article_id)}`} className="feed__link article-link">
        <time
          dateTime={article.published_at}
          className="feed__time"
          style={{
            display: "block",
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
            marginBottom: "0.35rem",
          }}
        >
          {article.published_at}
        </time>
        <span className="feed__title" style={{ display: "inline", marginRight: "0.35rem" }}>
          {replaceTickerCodesWithNames(article.title, article.stock_codes)}
        </span>
        {article.cum_ret_1d_pct !== null || article.quant_score_total !== null ? (
          <span
            style={{
              display: "inline",
              fontSize: "0.75rem",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
            title={
              [
                article.quant_score_total !== null
                  ? `퀀트스코어(0~99): 1·3·5·8거래일 복합 우상향 확률 기반, 기술+이벤트+감성 피처 학습 모델`
                  : null,
                article.cum_ret_1d_pct !== null
                  ? `1거래일 누적: 발행 전일(D-1) 종가 대비 (${article.quote_ticker ?? "—"})`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            {(() => {
              type Part = { key: string; node: ReactNode };
              const parts: Part[] = [];
              if (article.quant_score_total !== null) {
                parts.push({
                  key: "q",
                  node: (
                    <span style={{ color: "var(--color-accent, #1c4d48)", fontWeight: 600 }}>
                      퀀트스코어 {formatQuantScore(article.quant_score_total)}
                    </span>
                  ),
                });
              }
              if (article.cum_ret_1d_pct !== null) {
                parts.push({
                  key: "1d",
                  node: (
                    <span
                      style={{
                        color: article.cum_ret_1d_pct >= 0 ? "#15803d" : "#b91c1c",
                      }}
                    >
                      1일 {formatCumRetPct(article.cum_ret_1d_pct)}
                    </span>
                  ),
                });
              }
              return parts.map(({ key, node }, i) => (
                <Fragment key={key}>
                  {i > 0 ? (
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}> · </span>
                  ) : null}
                  {node}
                </Fragment>
              ));
            })()}
          </span>
        ) : null}
        {article.stock_codes.length > 0 ? (
          <span
            className="feed__tickers"
            title={`종목코드: ${article.stock_codes.join(", ")}`}
            style={{
              display: "block",
              marginTop: "0.5rem",
              fontSize: "0.6875rem",
              color: "var(--color-text-muted)",
              letterSpacing: "0.02em",
            }}
          >
            {formatTickerListForDisplay(article.stock_codes)}
          </span>
        ) : null}
      </Link>
    </li>
  ));
}

/** 목록이 0일 때: SomedayNews는 RTDB만 사용 → 서비스 계정·노드 데이터·매니페스트 교집합 순으로 안내 */
function homeFeedEmptyExplanation(d: SomedayNewsFeedDebugSnapshot): string {
  if (d.somedaySource === "unconfigured") {
    if (process.env.VERCEL === "1") {
      return "Vercel 서버에 Firebase Admin 환경 변수가 없습니다. 프로젝트 → Settings → Environment Variables에 FIREBASE_DATABASE_URL과 FIREBASE_SERVICE_ACCOUNT_JSON(서비스 계정 JSON 전체 문자열, Sensitive)을 production(및 필요 시 preview)에 넣고 재배포하세요. 파일 경로(GOOGLE_APPLICATION_CREDENTIALS)는 서버리스에서 쓸 수 없습니다.";
    }
    return "서버(Admin)가 RTDB를 읽지 못했습니다. .env.local에 FIREBASE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS(서비스 계정 JSON 경로)를 넣고 dev 서버를 재시작하세요. NEXT_PUBLIC_* 만으로는 서버에서 DB를 읽을 수 없습니다.";
  }
  if (d.rawRecordCount === 0) {
    return "Firebase RTDB의 SomedayNews 배열이 비어 있거나 없습니다. 노드 somedaynews/somedaynews_article_tickers 를 확인하거나, 로컬 JSON이 있다면 npm run sync-somedaynews-firebase 로 올리세요.";
  }
  if (d.dedupedArticleCount > 0 && d.afterFilterTotal === 0) {
    return "RTDB에는 기사가 있으나, EODHD 5분봉·일봉 매니페스트에 연결된 article_id와 겹치지 않습니다.";
  }
  return "조건에 맞는 뉴스가 없습니다.";
}

const homeListOptions = {
  limit: LIST_LIMIT,
  requireIntradayOk: true as const,
};

export default async function Home() {
  const showFeedDebug =
    process.env.NODE_ENV === "development" || process.env.DEBUG_HOME_FEED === "1";

  const [{ items: rawArticles, total }, feedDebug] = await Promise.all([
    getSomedayNewsList(homeListOptions),
    getSomedayNewsFeedDebugSnapshot(homeListOptions),
  ]);

  const articles = rawArticles.filter((a) => !HOME_FEED_EXCLUDED_ARTICLE_IDS.has(a.article_id));

  const enriched = await enrichHomeFeedWith3dCumRet(articles, { parallel: 12 });
  const { high, low, unknown } = splitHomeFeedBy1dReturnHalf(enriched);
  const splitOk = high.length > 0 && low.length > 0;

  if (showFeedDebug) {
    console.log("[home feed debug]", JSON.stringify(feedDebug, null, 2));
  }

  return (
    <main className="news-container">
      <header className="page-heading">
        <h1 className="page-heading__title">FAM 뉴스</h1>
      </header>

      <section className="feed" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="feed__label">
          API 수집 뉴스 목록
        </h2>
        <p className="feed__meta muted-text" style={{ margin: "0 0 1rem", fontSize: "0.875rem" }}>
          {total === 0
            ? homeFeedEmptyExplanation(feedDebug)
            : `5분봉 연동(EODHD) 기사 ${total.toLocaleString()}건 중 최신 ${articles.length.toLocaleString()}건`}
        </p>
        {total > 0 ? (
          <p className="feed__meta muted-text" style={{ margin: "-0.5rem 0 1rem", fontSize: "0.8125rem", lineHeight: 1.5 }}>
            제목 옆: 매니페스트 첫 종목 기준{" "}
            <strong>퀀트스코어</strong>(0~99, 청록 — 1·3·5·8거래일 복합 우상향 ML 모델)와 <strong>1거래일 누적 수익률</strong>(녹/적, EOD 직접 계산)입니다. 구간 나눔은{" "}
            <strong>1거래일 누적%</strong> 기준 상대 상위·하위 절반이며, 각 구역 안에서는 같은 구간에서 정규화한 <strong>누적% + 퀀트스코어</strong> 합이 큰 순(둘 다 높을수록 위)입니다.
          </p>
        ) : null}
        {articles.length === 0 ? (
          <ul className="feed__list">
            <li className="feed__empty">표시할 뉴스가 없습니다.</li>
          </ul>
        ) : splitOk ? (
          <>
            <h3
              className="feed__split-heading"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                margin: "0 0 0.5rem",
                color: "var(--color-text)",
              }}
            >
              1거래일 누적 수익률 — 상대 상위
            </h3>
            <ul className="feed__list">{feedArticleItems(high, true)}</ul>
            <h3
              className="feed__split-heading"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                margin: "1.25rem 0 0.5rem",
                color: "var(--color-text)",
              }}
            >
              1거래일 누적 수익률 — 상대 하위
            </h3>
            <ul className="feed__list">{feedArticleItems(low, true)}</ul>
            {unknown.length > 0 ? (
              <>
                <h3
                  className="feed__split-heading"
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    margin: "1.25rem 0 0.5rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  1거래일 누적 산출 불가 (EOD 구간 부족 · 5분봉 없음 등)
                </h3>
                <ul className="feed__list">{feedArticleItems(unknown, true)}</ul>
              </>
            ) : null}
          </>
        ) : (
          <ul className="feed__list">{feedArticleItems(sortHomeFeedBy1dReturnDesc(enriched), true)}</ul>
        )}
      </section>

      {showFeedDebug ? (
        <section
          className="feed-debug"
          aria-label="홈 피드 디버그"
          style={{
            marginTop: "2rem",
            padding: "0.75rem 1rem",
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
            background: "var(--quant-canvas, rgba(0,0,0,0.04))",
            borderRadius: "var(--radius-sm, 6px)",
            border: "1px dashed var(--color-border, #ccc)",
          }}
        >
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              홈 피드 디버그 (dev / DEBUG_HOME_FEED)
            </summary>
            <pre
              style={{
                margin: "0.75rem 0 0",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(feedDebug, null, 2)}
            </pre>
            <p style={{ margin: "0.5rem 0 0", opacity: 0.85 }}>
              터미널에도 <code>[home feed debug]</code> 로그가 출력됩니다. somedaySource가
              unconfigured면 Admin RTDB 미설정, rawRecordCount=0이면 RTDB 노드가 비었거나 없음.
              dedupedArticleCount는 있는데 afterFilterTotal=0이면 매니페스트와 article_id가 안 맞는 경우입니다.
            </p>
          </details>
        </section>
      ) : null}
    </main>
  );
}
