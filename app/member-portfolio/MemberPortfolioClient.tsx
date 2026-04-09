"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { extractKoreaTickerFromInput } from "@/lib/korea-ticker";
import {
  PORTFOLIO_TABS,
  type PortfolioTabId,
} from "@/lib/member-portfolio/constants";
import {
  buildPortfolioCsvMatrix,
  downloadUtf8Csv,
  matrixToCsvString,
} from "@/lib/member-portfolio/csv";
import { averageChangePctEqualWeight } from "@/lib/member-portfolio/metrics";
import { usePortfolioQuotes } from "@/lib/member-portfolio/usePortfolioQuotes";
import { useSyncedPortfolioTickers } from "@/lib/member-portfolio/useSyncedPortfolioTickers";
import { PortfolioHoldingsTable } from "./components/PortfolioHoldingsTable";
import { PortfolioSyncBanner } from "./components/PortfolioSyncBanner";

export function MemberPortfolioClient({
  tickerNames,
}: {
  tickerNames: Record<string, string>;
}) {
  const { tickers, commitTickers, syncState } = useSyncedPortfolioTickers();
  const { quotes, quotesLoading } = usePortfolioQuotes(tickers);
  const [addInput, setAddInput] = useState("");
  const [tab, setTab] = useState<PortfolioTabId>("summary");
  const [compact, setCompact] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const todayGainPct = useMemo(() => averageChangePctEqualWeight(tickers, quotes), [tickers, quotes]);

  const addTicker = () => {
    const t = extractKoreaTickerFromInput(addInput);
    if (!t) return;
    if (tickers.includes(t)) {
      setAddInput("");
      return;
    }
    commitTickers([...tickers, t]);
    setAddInput("");
  };

  const removeTicker = (t: string) => {
    commitTickers(tickers.filter((x) => x !== t));
  };

  const downloadCsv = () => {
    const matrix = buildPortfolioCsvMatrix(tickers, tickerNames, quotes);
    downloadUtf8Csv("fam-portfolio", matrixToCsvString(matrix));
  };

  const showTable = tab === "summary" || tab === "holdings";
  const tabMeta = PORTFOLIO_TABS.find((x) => x.id === tab);

  return (
    <div className="member-portfolio" data-test-id="portfolio-page">
      <div className="member-portfolio__container" data-test-id="grid-container">
        <header className="member-portfolio__header" data-test-id="portfolio-header-content-wrapper">
          <div className="member-portfolio__header-top">
            <div className="member-portfolio__title-block">
              <h1 className="member-portfolio__h1">
                <details className="member-portfolio__portfolio-select">
                  <summary className="member-portfolio__portfolio-summary">
                    <span className="member-portfolio__portfolio-name">기본 포트폴리오</span>
                    <span className="member-portfolio__chevron" aria-hidden>
                      <svg width="12" height="8" viewBox="0 0 18 11" fill="currentColor">
                        <path d="M2.1 0 9 6.84 15.9 0 18 2.08 9 11 0 2.08z" />
                      </svg>
                    </span>
                  </summary>
                  <ul className="member-portfolio__portfolio-menu">
                    <li>
                      <button type="button">기본 포트폴리오</button>
                    </li>
                  </ul>
                </details>
              </h1>
            </div>
            <ul className="member-portfolio__actions" data-test-id="portfolio-actions">
              <li>
                <button type="button" className="member-portfolio__btn member-portfolio__btn--dark" disabled>
                  피드백
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="member-portfolio__btn"
                  data-test-id="add-symbols-button"
                  onClick={() => addInputRef.current?.focus()}
                >
                  + 종목 추가
                </button>
              </li>
              <li>
                <button type="button" className="member-portfolio__btn" data-test-id="edit-portfolio-button">
                  편집
                </button>
              </li>
              <li>
                <button type="button" className="member-portfolio__btn" data-test-id="manage-alerts-button">
                  알림
                </button>
              </li>
              <li>
                <button type="button" className="member-portfolio__btn" onClick={downloadCsv}>
                  다운로드
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="member-portfolio__btn"
                  data-test-id="change-portfolio-layout-button"
                  onClick={() => setCompact((c) => !c)}
                >
                  레이아웃
                </button>
              </li>
            </ul>
          </div>

          <PortfolioSyncBanner syncState={syncState} />

          <div className="member-portfolio__totals" data-test-id="portfolio-totals">
            <div className="member-portfolio__totals-label">오늘 손익 (동일가중·EOD 샘플)</div>
            <div
              className="member-portfolio__totals-value"
              data-test-id="portfolio-health-check-todays-gain"
            >
              {quotesLoading ? (
                <span className="member-portfolio__muted">불러오는 중…</span>
              ) : todayGainPct == null ? (
                <span className="member-portfolio__muted">데이터 없음</span>
              ) : (
                <span
                  className={
                    todayGainPct > 0
                      ? "member-portfolio__pct--up"
                      : todayGainPct < 0
                        ? "member-portfolio__pct--down"
                        : ""
                  }
                >
                  {todayGainPct > 0 ? "▲ " : todayGainPct < 0 ? "▼ " : ""}
                  {todayGainPct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          <div className="member-portfolio__add-row">
            <input
              ref={addInputRef}
              className="member-portfolio__input"
              placeholder="6자리 종목코드"
              maxLength={6}
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTicker()}
              aria-label="종목코드 입력"
            />
            <button type="button" className="member-portfolio__btn member-portfolio__btn--primary" onClick={addTicker}>
              추가
            </button>
          </div>
        </header>

        <nav className="member-portfolio__tabs" data-test-id="portfolio-tabs" aria-label="포트폴리오 하위 메뉴">
          <div className="member-portfolio__tabs-list" data-test-id="tabs-list" role="tablist">
            {PORTFOLIO_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                data-test-id={t.testId}
                className={`member-portfolio__tab${tab === t.id ? " member-portfolio__tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.lockIcon ? (
                  <span className="member-portfolio__tab-lock" aria-hidden>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M12.222 6.815h-1.185V5.333a2.67 2.67 0 0 0-2.67-2.666H7.189a2.67 2.67 0 0 0-2.67 2.666v1.482H3.333v6.518h8.89zm-6.518 0h4.148V5.333c0-.816-.666-1.481-1.485-1.481H7.189c-.82 0-1.485.664-1.485 1.481zM4.519 8v4.148h6.518V8z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                ) : null}
                {t.label}
              </button>
            ))}
            <div className="member-portfolio__tabs-spacer" />
            <button type="button" className="member-portfolio__linkish" disabled>
              뷰 편집
            </button>
            <label className="member-portfolio__group-label">
              <span className="member-portfolio__sr-only">그룹</span>
              <select className="member-portfolio__select" disabled defaultValue="ungrouped">
                <option value="ungrouped">미그룹</option>
              </select>
            </label>
          </div>
        </nav>

        <section className="member-portfolio__panel" role="tabpanel" data-test-id="portfolio-container">
          {!showTable ? (
            <div className="member-portfolio__card member-portfolio__placeholder">
              <p className="member-portfolio__placeholder-title">{tabMeta?.label}</p>
              <p className="member-portfolio__placeholder-text">
                {tab === "ratings"
                  ? "레이팅 요약은 추후 연동 예정입니다."
                  : "준비 중입니다."}
              </p>
            </div>
          ) : tickers.length === 0 ? (
            <div className="member-portfolio__card member-portfolio__empty">
              <p>보유 종목이 없습니다. 위에서 6자리 코드를 추가하세요.</p>
            </div>
          ) : (
            <PortfolioHoldingsTable
              tickers={tickers}
              quotes={quotes}
              tickerNames={tickerNames}
              compact={compact}
              onRemove={removeTicker}
            />
          )}
        </section>
      </div>

      <p className="member-portfolio__footer">
        <Link href="/member-dashboard" className="article-link">
          ← 유료회원 전용 대시보드
        </Link>
        {" · "}
        <Link href="/" className="article-link">
          뉴스 목록
        </Link>
      </p>
    </div>
  );
}
