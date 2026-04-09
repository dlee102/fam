/**
 * 로컬 `data/somedaynews_article_tickers.json` → Firebase RTDB
 * 경로: `{FIREBASE_SOMEDAYNEWS_RTD_ROOT}/somedaynews_article_tickers` (기본 루트 somedaynews)
 *
 *   npx tsx scripts/sync-somedaynews-to-firebase.ts
 *
 * 필요: FIREBASE_DATABASE_URL 또는 NEXT_PUBLIC_FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_JSON
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const LOCAL = path.join(process.cwd(), "data", "somedaynews_article_tickers.json");
const RTD_ROOT = process.env.FIREBASE_SOMEDAYNEWS_RTD_ROOT ?? "somedaynews";
const KEY = `${RTD_ROOT.replace(/^\/+|\/+$/g, "")}/somedaynews_article_tickers`;

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
      return JSON.parse(fs.readFileSync(credPath, "utf8")) as admin.ServiceAccount;
    } catch {
      console.error("GOOGLE_APPLICATION_CREDENTIALS 읽기 실패:", credPath);
      return null;
    }
  }
  return null;
}

async function main() {
  if (!fs.existsSync(LOCAL)) {
    console.error("파일 없음:", LOCAL);
    process.exit(1);
  }
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim();
  const cred = loadServiceAccountJson();
  if (!databaseURL) {
    console.error(
      "DB URL 없음: FIREBASE_DATABASE_URL 또는 NEXT_PUBLIC_FIREBASE_DATABASE_URL 을 .env.local 에 넣으세요."
    );
    process.exit(1);
  }
  if (!cred) {
    console.error(
      "서비스 계정 없음. 아래 중 하나를 .env.local 에 추가하세요:\n" +
        "  - FIREBASE_SERVICE_ACCOUNT_JSON={...한 줄 JSON...}\n" +
        "  - GOOGLE_APPLICATION_CREDENTIALS=/절대경로/서비스계정.json  (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비밀 키)"
    );
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(cred),
      databaseURL,
    });
  }
  const data = JSON.parse(fs.readFileSync(LOCAL, "utf8")) as unknown;
  if (!Array.isArray(data)) {
    console.error("JSON이 배열이 아님");
    process.exit(1);
  }
  const db = admin.database();
  await db.ref(KEY).set(data);
  console.log(`업로드 완료: ${data.length}건 → RTDB /${KEY}`);
}

void main();
