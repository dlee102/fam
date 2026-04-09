import fs from "fs";
import path from "path";

import type { FundamentalModelContextFile, FundamentalSnapshotForModel } from "./types";
import { buildModelContextFromRawBundle } from "./build-context-file";
import { pickSnapshotForTicker } from "./resolve-for-ticker";

const SLIM_FILENAME = "fundamentals_model_context.json";

type Cache = {
  mtimeMs: number;
  filePath: string;
  data: FundamentalModelContextFile;
};

let cache: Cache | null = null;

function fundamentalsRoot(cwd: string): string {
  return path.join(cwd, "data", "yfinance_fundamentals");
}

function resolveExplicitPath(cwd: string): string | null {
  const env = process.env.QUANT_FUNDAMENTALS_CONTEXT_JSON?.trim();
  if (env) {
    const p = path.isAbsolute(env) ? env : path.join(cwd, env);
    if (fs.existsSync(p)) return p;
  }
  const slim = path.join(fundamentalsRoot(cwd), SLIM_FILENAME);
  if (fs.existsSync(slim)) return slim;
  return null;
}

function findLatestBundleJson(cwd: string): { path: string; rel: string } | null {
  const root = fundamentalsRoot(cwd);
  if (!fs.existsSync(root)) return null;
  const names = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => /^\d{8}T/.test(n))
    .sort()
    .reverse();
  for (const dir of names) {
    const full = path.join(root, dir, "fundamentals.json");
    if (fs.existsSync(full)) {
      return { path: full, rel: path.relative(cwd, full) };
    }
  }
  return null;
}

function loadFileFresh(absPath: string): FundamentalModelContextFile {
  const raw = fs.readFileSync(absPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (
    parsed &&
    typeof parsed === "object" &&
    "by_ticker" in (parsed as object) &&
    !("tickers" in (parsed as object))
  ) {
    return parsed as FundamentalModelContextFile;
  }
  const rel = path.relative(process.cwd(), absPath);
  return buildModelContextFromRawBundle(parsed, rel || absPath);
}

export function loadFundamentalModelContextFile(cwd: string = process.cwd()): FundamentalModelContextFile | null {
  const explicit = resolveExplicitPath(cwd);
  if (explicit) {
    const st = fs.statSync(explicit);
    if (cache && cache.filePath === explicit && cache.mtimeMs === st.mtimeMs) {
      return cache.data;
    }
    const data = loadFileFresh(explicit);
    cache = { mtimeMs: st.mtimeMs, filePath: explicit, data };
    return data;
  }

  const latest = findLatestBundleJson(cwd);
  if (!latest) return null;

  const st = fs.statSync(latest.path);
  if (cache && cache.filePath === latest.path && cache.mtimeMs === st.mtimeMs) {
    return cache.data;
  }
  const raw = fs.readFileSync(latest.path, "utf8");
  const data = buildModelContextFromRawBundle(JSON.parse(raw), latest.rel);
  cache = { mtimeMs: st.mtimeMs, filePath: latest.path, data };
  return data;
}

export function getFundamentalSnapshotForTicker(
  ticker: string,
  cwd: string = process.cwd()
): FundamentalSnapshotForModel | null {
  const file = loadFundamentalModelContextFile(cwd);
  return pickSnapshotForTicker(file, ticker);
}

export function clearFundamentalContextCache(): void {
  cache = null;
}
