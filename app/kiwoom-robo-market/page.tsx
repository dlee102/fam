import { fetchPharmArticles } from "@/lib/crawl-pharm";
import { getArticleByNewsId } from "@/lib/news-tickers";
import { getStockChartData } from "@/lib/stock-chart-api";
import { getTickerName } from "@/lib/ticker-names";
import { buildFallbackOhlc } from "@/lib/kiwoom-fallback-ohlc";
import { computeKiwoomBands } from "@/lib/kiwoom-robo-bands";
import { KiwoomRoboMarketContent } from "./KiwoomRoboMarketContent";

export const metadata = {
  title: "키움 로보마켓 | FAM",
  description: "키움 로보마켓 인사이트",
};

/** 기사·일봉을 요청마다 갱신 */
export const dynamic = "force-dynamic";

const FALLBACK_TICKER = "005930";
/** ls_stock_1d에 데이터가 있는 날짜 중 하나 (티커/날짜 폴백 시) */
const FALLBACK_CENTER_DATE = "20260219";

function normalizeCenterDate(published?: string): string {
  const c = published?.replace(/-/g, "").trim();
  if (c && /^\d{8}$/.test(c)) return c;
  return FALLBACK_CENTER_DATE;
}

export default async function KiwoomRoboMarketPage() {
  let articleTitle = "최신 기사를 불러오지 못했습니다.";
  let articleNewsId: string | null = null;
  try {
    const articles = await fetchPharmArticles(1);
    const first = articles[0];
    if (first) {
      articleTitle = first.title;
      articleNewsId = first.newsId;
    }
  } catch {
    articleTitle = "기사 목록을 불러오지 못했습니다.";
  }

  const entry = articleNewsId ? getArticleByNewsId(articleNewsId) : null;
  const listed = entry?.tickers?.filter((t) => /^\d{6}$/.test(t)) ?? [];
  const usedFallbackTicker = listed.length === 0;
  const ticker = listed[0] ?? FALLBACK_TICKER;
  const centerDate = normalizeCenterDate(entry?.published_date);

  const chartRes = await getStockChartData(centerDate, [ticker]);
  let ohlc = chartRes?.data?.[ticker] ?? [];
  let usedSyntheticOhlc = false;
  if (ohlc.length === 0) {
    ohlc = buildFallbackOhlc(centerDate, ticker);
    usedSyntheticOhlc = ohlc.length > 0;
  }
  const bandPack = ohlc.length > 0 ? computeKiwoomBands(ohlc) : null;
  const bands = bandPack?.bands ?? null;
  const bandMeta = bandPack?.meta ?? null;
  const lastClose = bandPack?.referenceClose ?? null;
  const tickerName = getTickerName(ticker);

  const chartError =
    ohlc.length === 0
      ? `일봉을 불러오지 못했습니다. ls_stock_1d/${ticker}_1d.csv 와 기준일 ${centerDate} 구간을 확인하세요.`
      : null;

  return (
    <main style={{ padding: "2rem 0 3rem", width: "100%" }}>
      <p
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          marginBottom: "1.25rem",
        }}
      >
        키움 로보마켓
      </p>

      <KiwoomRoboMarketContent
        articleTitle={articleTitle}
        articleNewsId={articleNewsId}
        ohlc={ohlc}
        bands={bands}
        bandMeta={bandMeta}
        lastClose={lastClose}
        ticker={ticker}
        tickerName={tickerName}
        centerDate={centerDate}
        chartError={chartError}
        usedFallbackTicker={usedFallbackTicker}
        usedSyntheticOhlc={usedSyntheticOhlc}
      />
    </main>
  );
}
