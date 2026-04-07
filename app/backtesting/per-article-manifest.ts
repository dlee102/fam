import fs from "fs";
import path from "path";

const MANIFEST_REL = "data/eodhd_news_windows/per_article/manifest_per_article.json";

export type PerArticleManifestRow = {
  article_idx: number;
  article_id: string;
  ticker: string;
  published_at: string;
  t0_kst: string;
  window_from: string;
  window_to: string;
  suffix: string;
  eod_ok: boolean;
  intraday_ok: boolean;
  eod_path: string;
  intraday_path: string;
  eod_rows?: number;
  intraday_rows?: number;
};

export type PerArticleManifestSummary = {
  total: number;
  eodOk: number;
  intradayOk: number;
  bothOk: number;
  missingEod: number;
  missingIntraday: number;
  publishedMin: string | null;
  publishedMax: string | null;
  distinctTickers: number;
  topTickers: { ticker: string; count: number }[];
  fileMtimeIso: string | null;
};

function parseTime(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export function loadPerArticleManifest(): {
  rows: PerArticleManifestRow[];
  summary: PerArticleManifestSummary;
  relativePath: string;
} {
  const full = path.join(process.cwd(), MANIFEST_REL);
  if (!fs.existsSync(full)) {
    return {
      rows: [],
      summary: {
        total: 0,
        eodOk: 0,
        intradayOk: 0,
        bothOk: 0,
        missingEod: 0,
        missingIntraday: 0,
        publishedMin: null,
        publishedMax: null,
        distinctTickers: 0,
        topTickers: [],
        fileMtimeIso: null,
      },
      relativePath: MANIFEST_REL,
    };
  }

  const raw = fs.readFileSync(full, "utf-8");
  const rows = JSON.parse(raw) as PerArticleManifestRow[];

  let eodOk = 0;
  let intradayOk = 0;
  let bothOk = 0;
  const tickerCounts = new Map<string, number>();
  let pubMin = "";
  let pubMax = "";
  let pubMinT = Infinity;
  let pubMaxT = -Infinity;

  for (const r of rows) {
    if (r.eod_ok) eodOk += 1;
    if (r.intraday_ok) intradayOk += 1;
    if (r.eod_ok && r.intraday_ok) bothOk += 1;
    tickerCounts.set(r.ticker, (tickerCounts.get(r.ticker) ?? 0) + 1);
    const pt = parseTime(r.published_at);
    if (pt > 0) {
      if (pt < pubMinT) {
        pubMinT = pt;
        pubMin = r.published_at;
      }
      if (pt > pubMaxT) {
        pubMaxT = pt;
        pubMax = r.published_at;
      }
    }
  }

  const topTickers = [...tickerCounts.entries()]
    .map(([ticker, count]) => ({ ticker, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const sorted = [...rows].sort((a, b) => parseTime(b.published_at) - parseTime(a.published_at));

  let mtime: string | null = null;
  try {
    mtime = new Date(fs.statSync(full).mtimeMs).toISOString();
  } catch {
    mtime = null;
  }

  const total = rows.length;
  const summary: PerArticleManifestSummary = {
    total,
    eodOk,
    intradayOk,
    bothOk,
    missingEod: total - eodOk,
    missingIntraday: total - intradayOk,
    publishedMin: pubMin || null,
    publishedMax: pubMax || null,
    distinctTickers: tickerCounts.size,
    topTickers,
    fileMtimeIso: mtime,
  };

  return { rows: sorted, summary, relativePath: MANIFEST_REL };
}
