import fs from "fs";
import path from "path";
import { fetchEodhdJsonFromRtdb } from "@/lib/firebase/rtdb-eodhd";

const BASE = path.join(process.cwd(), "data", "eodhd_news_windows");

/**
 * `data/eodhd_news_windows` 기준 상대 경로 (예: per_article/manifest_per_article.json).
 * 로컬 파일이 있으면 우선 사용, 없으면 Firebase RTDB에서 조회.
 */
export async function readEodhdJson<T>(relativePath: string): Promise<T | null> {
  const rel = relativePath.replace(/^\/+/, "");
  const abs = path.join(BASE, rel);
  if (fs.existsSync(abs)) {
    try {
      return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
    } catch {
      return null;
    }
  }
  return fetchEodhdJsonFromRtdb<T>(rel);
}
