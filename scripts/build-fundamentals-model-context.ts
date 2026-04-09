/**
 * 대용량 data/yfinance_fundamentals/<타임스탬프>/fundamentals.json 중 최신(또는 인자)을 읽어
 * data/yfinance_fundamentals/fundamentals_model_context.json 경량 파일을 생성.
 *
 *   npx tsx scripts/build-fundamentals-model-context.ts
 *   npx tsx scripts/build-fundamentals-model-context.ts data/yfinance_fundamentals/foo/fundamentals.json
 */

import fs from "fs";
import path from "path";

import { buildModelContextFromRawBundle } from "@/lib/quant-fundamentals/build-context-file";

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "yfinance_fundamentals", "fundamentals_model_context.json");

function latestBundlePath(): string | null {
  const base = path.join(ROOT, "data", "yfinance_fundamentals");
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => /^\d{8}T/.test(n))
    .sort()
    .reverse();
  for (const dir of dirs) {
    const p = path.join(base, dir, "fundamentals.json");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function main() {
  const arg = process.argv[2];
  const src = arg
    ? path.isAbsolute(arg)
      ? arg
      : path.join(ROOT, arg)
    : latestBundlePath();
  if (!src || !fs.existsSync(src)) {
    console.error("fundamentals.json 없음. yfinance 스크립트로 먼저 수집하거나 경로를 인자로 주세요.");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(src, "utf8"));
  const rel = path.relative(ROOT, src);
  const ctx = buildModelContextFromRawBundle(raw, rel);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(ctx, null, 2), "utf8");
  const n = Object.keys(ctx.by_ticker).length;
  console.log(`작성: ${OUT} (${n} tickers, source: ${rel})`);
}

main();
