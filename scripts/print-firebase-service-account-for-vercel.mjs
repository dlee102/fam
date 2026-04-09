#!/usr/bin/env node
/**
 * .env.local 의 GOOGLE_APPLICATION_CREDENTIALS JSON 파일을 읽어
 * FIREBASE_SERVICE_ACCOUNT_JSON 용 한 줄 문자열로 출력합니다.
 *
 *   node scripts/print-firebase-service-account-for-vercel.mjs
 *   npm run print-firebase-vercel-env
 *
 * 클립보드에 복사 (macOS):
 *   npm run print-firebase-vercel-env | pbcopy
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config();

const p = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
if (!p) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS 가 .env.local 에 없습니다. 서비스 계정 JSON 파일 경로를 넣으세요."
  );
  process.exit(1);
}

const abs = path.isAbsolute(p) ? p : path.join(root, p.replace(/^\.\//, ""));
if (!fs.existsSync(abs)) {
  console.error("파일 없음:", abs);
  process.exit(1);
}

const raw = fs.readFileSync(abs, "utf8");
const obj = JSON.parse(raw);
process.stdout.write(JSON.stringify(obj) + "\n");
