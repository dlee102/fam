/**
 * SomedayNews 메타(제목·티커) + (선택) 팜이데일리 크롤 본문 + Gemini로 종목별 1차 비즈니스 타입 분류.
 *
 * 입력:
 *   - data/somedaynews_article_tickers.json (published_at 2025~2026, 제목·티커)
 *   - pharm_crawler/pharm_articles_sentiment_final.json (body·tickers) — PHARM_ARTICLES_JSON 로 경로 변경 가능
 * 출력: data/bio_business_type_by_ticker.json
 *
 * 실행:
 *   npx tsx scripts/classify-bio-business-type-gemini.ts
 *   npx tsx scripts/classify-bio-business-type-gemini.ts --no-body   # 제목만 (본문 JSON 무시)
 *   npx tsx scripts/classify-bio-business-type-gemini.ts --limit=30
 *   npx tsx scripts/classify-bio-business-type-gemini.ts --dry-run
 *   npx tsx scripts/classify-bio-business-type-gemini.ts --force
 *
 * 환경변수: GEMINI_API_KEY 또는 GOOGLE_GENERATIVE_AI_API_KEY 또는 GOOGLE_API_KEY
 * 선택: GEMINI_MODEL, PHARM_ARTICLES_JSON (팜 기사 JSON 경로)
 */

import fs from "fs";
import path from "path";

import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

import {
  BIO_BUSINESS_TYPES,
  BIO_BUSINESS_TYPE_IDS,
  type BioBusinessTypeId,
} from "../lib/bio-business-types";
import { decodeHtmlEntities } from "../lib/decode-html-entities";
import {
  GEMINI_MODEL_DEFAULT,
  geminiModelCandidates,
  isGeminiModelNotFoundError,
} from "../lib/gemini-model-order";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const SOMEDAY = path.join(process.cwd(), "data", "somedaynews_article_tickers.json");
const TICKER_NAMES = path.join(process.cwd(), "data", "ticker_names.json");
const PHARM_ARTICLES_DEFAULT = path.join(
  process.cwd(),
  "pharm_crawler",
  "pharm_articles_sentiment_final.json"
);
const OUT = path.join(process.cwd(), "data", "bio_business_type_by_ticker.json");

/** 본문 스니펫 길이·개수 (토큰 한도) */
const PHARM_BODY_MAX_CHARS = 1800;
const PHARM_BODIES_PER_TICKER = 2;

const RANGE_FROM_MS = Date.parse("2025-01-01T00:00:00+09:00");
const RANGE_TO_MS = Date.parse("2027-01-01T00:00:00+09:00"); // exclusive

interface RawRow {
  published_at?: string;
  article_id?: string;
  title?: string;
  stock_codes?: string[];
}

interface SomedayDeduped {
  article_id: string;
  title: string;
  published_at: string;
  stock_codes: string[];
}

interface TickerContext {
  ticker: string;
  name: string;
  sample_titles: string[];
  /** pharm JSON 등에서 붙인 본문 발췌 (없으면 빈 배열) */
  body_snippets: string[];
}

interface ClassifiedRow {
  ticker: string;
  business_type_id: BioBusinessTypeId;
  confidence: number;
  rationale_ko: string;
}

interface OutputFile {
  generated_at: string;
  source: "gemini";
  model: string;
  date_range: { from: string; to: string; note: string };
  input_file: string;
  /** 본문 JSON 경로; --no-body 면 null */
  body_source: string | null;
  categories: typeof BIO_BUSINESS_TYPES;
  by_ticker: Record<
    string,
    {
      business_type_id: BioBusinessTypeId;
      confidence: number;
      rationale_ko: string;
      name: string;
      sample_title_count: number;
      body_snippet_count: number;
    }
  >;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let limit: number | null = null;
  let dryRun = false;
  let force = false;
  let noBody = false;
  let batchSize = 8;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a === "--force") force = true;
    else if (a === "--no-body") noBody = true;
    else if (a.startsWith("--limit=")) limit = Math.max(0, parseInt(a.slice(8), 10) || 0);
    else if (a.startsWith("--batch-size="))
      batchSize = Math.min(24, Math.max(3, parseInt(a.slice(13), 10) || 8));
  }
  return { limit, dryRun, force, noBody, batchSize };
}

function parsePublishedAt(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function dedupeSomeday(records: RawRow[]): SomedayDeduped[] {
  const byId = new Map<string, SomedayDeduped>();
  for (const row of records) {
    if (!row.article_id || !row.title) continue;
    const title = decodeHtmlEntities(row.title.trim());
    const codes = new Set(row.stock_codes ?? []);
    const cur = byId.get(row.article_id);
    if (!cur) {
      byId.set(row.article_id, {
        article_id: row.article_id,
        title,
        published_at: row.published_at ?? "",
        stock_codes: [...codes],
      });
      continue;
    }
    for (const c of row.stock_codes ?? []) cur.stock_codes.push(c);
    cur.stock_codes = [...new Set(cur.stock_codes)];
    if (parsePublishedAt(row.published_at ?? "") > parsePublishedAt(cur.published_at)) {
      cur.published_at = row.published_at ?? cur.published_at;
    }
  }
  return [...byId.values()];
}

function normalizeTicker(code: string): string {
  const s = String(code).replace(/\D/g, "");
  if (!s) return "";
  return s.length <= 6 ? s.padStart(6, "0") : s;
}

function loadTickerNames(): Record<string, string> {
  if (!fs.existsSync(TICKER_NAMES)) return {};
  try {
    return JSON.parse(fs.readFileSync(TICKER_NAMES, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

interface PharmArticleRow {
  body?: string | null;
  tickers?: string[];
}

/**
 * pharm_articles_sentiment_final.json: 기사별 body + tickers → 종목코드별 본문 스니펫(최대 N개).
 */
function loadPharmBodySnippetsByTicker(jsonPath: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!fs.existsSync(jsonPath)) return map;
  try {
    const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as PharmArticleRow[];
    if (!Array.isArray(rows)) return map;
    for (const row of rows) {
      const body = typeof row.body === "string" && row.body.trim() ? row.body.trim() : "";
      if (!body) continue;
      const snip =
        body.length > PHARM_BODY_MAX_CHARS
          ? `${body.slice(0, PHARM_BODY_MAX_CHARS)}…`
          : body;
      for (const raw of row.tickers ?? []) {
        const t = normalizeTicker(String(raw));
        if (!t) continue;
        let arr = map.get(t);
        if (!arr) {
          arr = [];
          map.set(t, arr);
        }
        if (arr.length >= PHARM_BODIES_PER_TICKER) continue;
        if (arr.some((x) => x === snip)) continue;
        arr.push(snip);
      }
    }
  } catch {
    return map;
  }
  return map;
}

function buildContexts(
  articles: SomedayDeduped[],
  names: Record<string, string>,
  bodyByTicker: Map<string, string[]>
): TickerContext[] {
  const byTicker = new Map<string, { name: string; titles: string[] }>();

  for (const a of articles) {
    const t0 = parsePublishedAt(a.published_at);
    if (t0 < RANGE_FROM_MS || t0 >= RANGE_TO_MS) continue;
    for (const raw of a.stock_codes) {
      const ticker = normalizeTicker(raw);
      if (!ticker || ticker === "000000") continue;
      const name = names[ticker] ?? names[raw] ?? ticker;
      let row = byTicker.get(ticker);
      if (!row) {
        row = { name, titles: [] };
        byTicker.set(ticker, row);
      }
      if (row.titles.length < 12 && a.title && !row.titles.includes(a.title)) {
        row.titles.push(a.title);
      }
    }
  }

  const list: TickerContext[] = [];
  for (const [ticker, { name, titles }] of byTicker) {
    const body_snippets = bodyByTicker.get(ticker) ?? [];
    list.push({ ticker, name, sample_titles: titles, body_snippets });
  }
  list.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return list;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : t;
}

function parseModelJsonArray(text: string): ClassifiedRow[] {
  const raw = stripJsonFence(text);
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) return [];
  const out: ClassifiedRow[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const ticker = normalizeTicker(String(r.ticker ?? ""));
    const id = String(r.business_type_id ?? "").trim();
    const conf = Number(r.confidence);
    const rationale = String(r.rationale_ko ?? r.rationale ?? "").trim();
    if (!ticker) continue;
    const business_type_id = (BIO_BUSINESS_TYPE_IDS as readonly string[]).includes(id)
      ? (id as BioBusinessTypeId)
      : ("unknown" as BioBusinessTypeId);
    out.push({
      ticker,
      business_type_id,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
      rationale_ko: rationale.slice(0, 500),
    });
  }
  return out;
}

const SYSTEM = `당신은 한국 상장사(코스피·코스닥)의 사업 모델을 분류한다.
각 종목에 대해 **뉴스 제목 샘플**과 (있으면) **기사 본문 발췌(body_snippets)**가 주어진다.
본문 발췌가 있으면 제목보다 본문을 우선해 회사의 통상적인 사업·매출 구조에 가깝게 판단한다.
없으면 제목과 종목명만으로 최선을 다하되, 애매하면 unknown.

반드시 다음 id 중 정확히 하나만 business_type_id에 넣는다:
${BIO_BUSINESS_TYPES.map((t) => `- ${t.id}: ${t.label}`).join("\n")}
- 위 여섯 가지에 명확히 맞지 않거나 정보가 부족하면: unknown

규칙:
- 단기 주가·임상 일회성 이벤트에만 나오는 표현보다 **지속적 수익 모델**을 본다.
- CDMO는 위탁생산·제조 인프라가 핵심인 경우. 자사 파이프라인이 더 중심이면 rd_pipeline.
- CRO는 타사 임상·비임상 **서비스**가 본업인 경우.
- 출력은 JSON 배열만. 다른 설명·마크다운 금지.
- 각 원소: {"ticker":"000000","business_type_id":"...","confidence":0.0~1.0,"rationale_ko":"한 줄 근거"}`;

async function classifyBatch(
  genAI: GoogleGenerativeAI,
  modelId: string,
  batch: TickerContext[]
): Promise<ClassifiedRow[]> {
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM,
  });
  const user = JSON.stringify(
    batch.map((b) => ({
      ticker: b.ticker,
      name: b.name,
      sample_titles: b.sample_titles,
      body_snippets: b.body_snippets,
    })),
    null,
    0
  );

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: `${user}\n\n위 배열과 동일한 순서·동일한 ticker로 결과 배열을 출력하라.` }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  const text = result.response.text()?.trim() ?? "";
  return parseModelJsonArray(text);
}

async function main() {
  const { limit, dryRun, force, noBody, batchSize } = parseArgs();

  const apiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY;
  if (!apiKey && !dryRun) {
    console.error("GEMINI_API_KEY (또는 GOOGLE_GENERATIVE_AI_API_KEY) 가 없습니다.");
    process.exit(1);
  }

  if (!fs.existsSync(SOMEDAY)) {
    console.error("파일 없음:", SOMEDAY);
    process.exit(1);
  }

  const pharmPath = process.env.PHARM_ARTICLES_JSON?.trim() || PHARM_ARTICLES_DEFAULT;
  const bodyByTicker = noBody ? new Map<string, string[]>() : loadPharmBodySnippetsByTicker(pharmPath);

  const raw = JSON.parse(fs.readFileSync(SOMEDAY, "utf8")) as RawRow[];
  const articles = Array.isArray(raw) ? dedupeSomeday(raw) : [];
  const names = loadTickerNames();
  let contexts = buildContexts(articles, names, bodyByTicker);
  const withBody = contexts.filter((c) => c.body_snippets.length > 0).length;
  console.log(
    `기간 필터 2025-01-01 ~ 2026-12-31 (KST 기준 published_at): 종목 ${contexts.length}개`
  );
  if (noBody) {
    console.log("본문: --no-body (제목만)");
  } else if (!fs.existsSync(pharmPath)) {
    console.log(`본문: 파일 없음 → 제목만 (${pharmPath})`);
  } else {
    console.log(`본문: ${pharmPath} — 대상 티커 중 본문 스니펫 있음 ${withBody}/${contexts.length}개`);
  }

  if (limit != null && limit > 0) contexts = contexts.slice(0, limit);

  let existing: OutputFile["by_ticker"] = {};
  if (!force && fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, "utf8")) as OutputFile;
      if (prev.by_ticker && typeof prev.by_ticker === "object") {
        existing = { ...prev.by_ticker };
        for (const k of Object.keys(existing)) {
          const row = existing[k];
          if (row && typeof row.body_snippet_count !== "number") {
            row.body_snippet_count = 0;
          }
        }
      }
    } catch {
      existing = {};
    }
  }

  const toRun = contexts.filter((c) => force || !existing[c.ticker]);
  console.log(
    `분류 대상: ${toRun.length}개 (스킵 ${contexts.length - toRun.length}, force=${force})`
  );

  if (dryRun) {
    const n = limit != null && limit > 0 ? limit : 3;
    console.log(
      "DRY RUN 샘플 (컨텍스트):",
      JSON.stringify(contexts.slice(0, n), null, 2)
    );
    console.log(
      `실행 시 분류 대상: ${toRun.length}개 (기존 JSON에 있으면 스킵 — 전부 다시: --force)`
    );
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey!);
  let lockedModel: string | null = null;

  const by_ticker: OutputFile["by_ticker"] = { ...existing };

  for (let i = 0; i < toRun.length; i += batchSize) {
    const batch = toRun.slice(i, i + batchSize);
    process.stdout.write(`배치 ${i / batchSize + 1} / ${Math.ceil(toRun.length / batchSize)} … `);
    const candidates: string[] = lockedModel ? [lockedModel] : geminiModelCandidates();
    let rows: ClassifiedRow[] | null = null;
    let lastErr: unknown;
    for (const mid of candidates) {
      try {
        rows = await classifyBatch(genAI, mid, batch);
        lockedModel = mid;
        break;
      } catch (e) {
        lastErr = e;
        if (isGeminiModelNotFoundError(e)) continue;
        break;
      }
    }
    if (rows) {
      const byT = new Map(rows.map((r) => [r.ticker, r]));
      for (const ctx of batch) {
        const r = byT.get(ctx.ticker);
        if (r) {
          by_ticker[ctx.ticker] = {
            business_type_id: r.business_type_id,
            confidence: r.confidence,
            rationale_ko: r.rationale_ko,
            name: ctx.name,
            sample_title_count: ctx.sample_titles.length,
            body_snippet_count: ctx.body_snippets.length,
          };
        } else {
          by_ticker[ctx.ticker] = {
            business_type_id: "unknown",
            confidence: 0,
            rationale_ko: "모델 응답에 해당 티커가 없음",
            name: ctx.name,
            sample_title_count: ctx.sample_titles.length,
            body_snippet_count: ctx.body_snippets.length,
          };
        }
      }
      console.log("ok", lockedModel ?? "");
    } else {
      console.log("fail", lastErr instanceof Error ? lastErr.message : lastErr);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const payload: OutputFile = {
    generated_at: new Date().toISOString(),
    source: "gemini",
    model: lockedModel ?? GEMINI_MODEL_DEFAULT,
    date_range: {
      from: "2025-01-01",
      to: "2026-12-31",
      note: "published_at 파싱값이 RANGE_FROM_MS 이상 RANGE_TO_MS 미만인 기사만 샘플 제목에 사용",
    },
    input_file: "data/somedaynews_article_tickers.json",
    body_source: noBody ? null : pharmPath,
    categories: BIO_BUSINESS_TYPES,
    by_ticker,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`저장: ${OUT} (총 ${Object.keys(by_ticker).length} 티커)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
