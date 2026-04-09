/**
 * 로컬 data/eodhd_news_windows 트리를 Firebase Realtime Database에 올립니다.
 *
 * 필요 환경 변수:
 *   FIREBASE_DATABASE_URL
 *   FIREBASE_SERVICE_ACCOUNT_JSON  (서비스 계정 JSON 전체 문자열)
 * 선택:
 *   FIREBASE_EODHD_RTD_ROOT (기본: eodhd_news_windows)
 *
 * 실행: npx tsx scripts/sync-eodhd-to-firebase.ts
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const LOCAL_ROOT = path.join(process.cwd(), "data", "eodhd_news_windows");
const RTD_ROOT =
  process.env.FIREBASE_EODHD_RTD_ROOT ?? "eodhd_news_windows";
const CONCURRENCY = 24;

function loadServiceAccountJson(): admin.ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline?.trim()) {
    try {
      return JSON.parse(inline) as admin.ServiceAccount;
    } catch {
      console.error("FIREBASE_SERVICE_ACCOUNT_JSON 파싱 실패");
      return null;
    }
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    try {
      return JSON.parse(
        fs.readFileSync(credPath, "utf8")
      ) as admin.ServiceAccount;
    } catch {
      console.error("GOOGLE_APPLICATION_CREDENTIALS 파일 읽기/파싱 실패:", credPath);
      return null;
    }
  }
  return null;
}

function initAdmin(): admin.database.Database {
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const cred = loadServiceAccountJson();
  if (!databaseURL || !cred) {
    console.error(
      "다음 중 하나가 필요합니다:\n" +
        "  - FIREBASE_DATABASE_URL (또는 NEXT_PUBLIC_FIREBASE_DATABASE_URL)\n" +
        "  - FIREBASE_SERVICE_ACCOUNT_JSON (JSON 문자열) 또는\n" +
        "  - GOOGLE_APPLICATION_CREDENTIALS (서비스 계정 .json 파일 경로)"
    );
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(cred),
      databaseURL,
    });
  }
  return admin.database();
}

function* walkJsonFiles(dir: string, baseRel = ""): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const rel = path.join(baseRel, ent.name);
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walkJsonFiles(full, rel);
    } else if (ent.isFile() && ent.name.endsWith(".json")) {
      yield rel;
    }
  }
}

function rtdbKeyFromRel(rel: string): string {
  return rel.split(path.sep).join("/").replace(/\.json$/i, "");
}

async function poolMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  if (!fs.existsSync(LOCAL_ROOT)) {
    console.error("로컬 폴더가 없습니다:", LOCAL_ROOT);
    process.exit(1);
  }

  const db = initAdmin();
  const rels = [...walkJsonFiles(LOCAL_ROOT)];
  console.log(`업로드 대상: ${rels.length}개 JSON (${LOCAL_ROOT}) → RTDB /${RTD_ROOT}`);

  let ok = 0;
  let fail = 0;

  await poolMap(rels, CONCURRENCY, async (rel) => {
    const full = path.join(LOCAL_ROOT, rel);
    const key = rtdbKeyFromRel(rel);
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8")) as unknown;
      await db.ref(`${RTD_ROOT}/${key}`).set(data);
      ok++;
    } catch (e) {
      console.error(rel, e);
      fail++;
    }
  });

  console.log(`완료: 성공 ${ok}, 실패 ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
