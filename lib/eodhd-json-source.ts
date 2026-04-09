import fs from "fs";
import path from "path";
import { fetchEodhdJsonFromRtdb } from "@/lib/firebase/rtdb-eodhd";

const BASE = path.join(process.cwd(), "data", "eodhd_news_windows");

/**
 * `data/eodhd_news_windows` 기준 상대 경로 (예: per_article/manifest_per_article.json).
 * 로컬에 유효한 JSON이 있으면 우선 사용. 파일만 있고 파싱 실패(Git LFS 포인터 등)면 RTDB로 폴백.
 */
export async function readEodhdJson<T>(relativePath: string): Promise<T | null> {
  const rel = relativePath.replace(/^\/+/, "");
  const abs = path.join(BASE, rel);
  if (fs.existsSync(abs)) {
    try {
      return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
    } catch {
      // LFS가 포인터만 두면 JSON이 아니므로 로컬 우선이 깨짐 → RTDB 시도
    }
  }
  return fetchEodhdJsonFromRtdb<T>(rel);
}
