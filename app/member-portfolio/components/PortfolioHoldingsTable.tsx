import { fmtPriceKo, fmtVolumeKo, signFromNumber, type SignedCss } from "@/lib/member-portfolio/format";
import type { PortfolioQuoteSnap } from "@/lib/member-portfolio/types";

type Props = {
  tickers: readonly string[];
  quotes: Readonly<Record<string, PortfolioQuoteSnap | null>>;
  tickerNames: Readonly<Record<string, string>>;
  compact: boolean;
  onRemove: (ticker: string) => void;
};

function numCellClass(sign: SignedCss): string {
  if (sign === "up") return " member-portfolio__num--up";
  if (sign === "down") return " member-portfolio__num--down";
  return "";
}

export function PortfolioHoldingsTable({ tickers, quotes, tickerNames, compact, onRemove }: Props) {
  return (
    <div
      className={`member-portfolio__table-card${compact ? " member-portfolio__table-card--dense" : ""}`}
      data-test-id="default-portfolio-tickers"
    >
      <div className="member-portfolio__table-wrap">
        <table className="member-portfolio__table">
          <thead>
            <tr>
              <th>종목코드</th>
              <th>종목명</th>
              <th className="member-portfolio__th-num">종가</th>
              <th className="member-portfolio__th-num">전일대비</th>
              <th className="member-portfolio__th-num">등락률</th>
              <th className="member-portfolio__th-num">거래량</th>
              <th className="member-portfolio__th-num">기준일</th>
              <th className="member-portfolio__th-icon" aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {tickers.map((t) => {
              const q = quotes[t];
              const name = tickerNames[t] ?? "—";
              const chSign = q ? signFromNumber(q.change) : "";
              const pctSign = q ? signFromNumber(q.changePct) : "";
              return (
                <tr key={t}>
                  <td>
                    <span className="member-portfolio__ticker">{t}</span>
                  </td>
                  <td className="member-portfolio__name">{name}</td>
                  <td className="member-portfolio__td-num">{q ? fmtPriceKo(q.close) : "—"}</td>
                  <td className={`member-portfolio__td-num${numCellClass(chSign)}`}>
                    {q ? (q.change >= 0 ? "+" : "") + fmtPriceKo(q.change) : "—"}
                  </td>
                  <td className={`member-portfolio__td-num${numCellClass(pctSign)}`}>
                    {q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="member-portfolio__td-num">{q ? fmtVolumeKo(q.volume) : "—"}</td>
                  <td className="member-portfolio__td-num member-portfolio__td-date">{q?.date ?? "—"}</td>
                  <td className="member-portfolio__td-icon">
                    <button
                      type="button"
                      className="member-portfolio__icon-btn"
                      aria-label={`${t} 삭제`}
                      onClick={() => onRemove(t)}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                        <path d="M4.667 14q-.55 0-.942-.392a1.28 1.28 0 0 1-.392-.941V4a.65.65 0 0 1-.475-.192.65.65 0 0 1-.191-.475q0-.283.191-.475a.65.65 0 0 1 .475-.191H6q0-.285.192-.475A.65.65 0 0 1 6.667 2h2.666q.285 0 .475.192a.65.65 0 0 1 .192.475h2.667q.283 0 .475.191a.65.65 0 0 1 .191.475.65.65 0 0 1-.191.475.65.65 0 0 1-.475.192v8.667q0 .55-.392.941a1.28 1.28 0 0 1-.942.392zm6.666-10H4.667v8.667h6.666z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="member-portfolio__table-note">
        종목 목록은 Firebase Realtime Database에 저장되면 브라우저·기기 간 실시간으로 맞춰집니다. 시세는 뉴스 연동 EOD 샘플의
        최신 2거래일 차이이며 실시간 호가가 아닙니다.
      </p>
    </div>
  );
}
