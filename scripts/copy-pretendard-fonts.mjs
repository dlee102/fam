#!/usr/bin/env node
/**
 * Vercel/로컬 빌드에서 CDN 대신 동일 출처로 Pretendard를 쓰기 위해
 * node_modules → public/fonts 로 woff2를 복사합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "node_modules/pretendard/dist/web/static/woff2");
const destDir = path.join(root, "public/fonts");

const files = [
  "Pretendard-Light.woff2",
  "Pretendard-Regular.woff2",
  "Pretendard-Medium.woff2",
  "Pretendard-SemiBold.woff2",
  "Pretendard-Bold.woff2",
];

if (!fs.existsSync(srcDir)) {
  console.warn("copy-pretendard-fonts: pretendard 패키지 없음, 건너뜀");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const f of files) {
  const from = path.join(srcDir, f);
  if (!fs.existsSync(from)) {
    console.warn(`copy-pretendard-fonts: 없음 ${from}`);
    continue;
  }
  fs.copyFileSync(from, path.join(destDir, f));
}
