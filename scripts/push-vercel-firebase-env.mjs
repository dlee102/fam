#!/usr/bin/env node
/**
 * .env.local + (선택) 서비스 계정 JSON 파일을 읽어 Vercel 프로젝트에 환경 변수를 등록합니다.
 *
 * 사전 준비: 프로젝트 루트에서 `vercel link` 완료, `vercel login` 상태
 *
 * 사용:
 *   node scripts/push-vercel-firebase-env.mjs
 *   VERCEL_TARGET_ENVS=production,preview node scripts/push-vercel-firebase-env.mjs
 *   node scripts/push-vercel-firebase-env.mjs --with-client   # NEXT_PUBLIC_FIREBASE_* 도 함께
 *
 * 서버용 값 출처:
 *   FIREBASE_DATABASE_URL 또는 NEXT_PUBLIC_FIREBASE_DATABASE_URL
 *   FIREBASE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS(파일 경로)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const withClient = process.argv.includes("--with-client");

const TARGET_ENVS = (process.env.VERCEL_TARGET_ENVS ?? "production")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function runVercel(args, { stdin } = {}) {
  const r = spawnSync("npx", ["vercel", ...args], {
    cwd: root,
    input: stdin,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const out = (r.stdout || "") + (r.stderr || "");
  return { status: r.status ?? 1, out };
}

function addPlain(name, value, targetEnv, extra = []) {
  if (!value) {
    console.warn(`건너뜀 (값 없음): ${name}`);
    return true;
  }
  const args = [
    "env",
    "add",
    name,
    targetEnv,
    "--value",
    value,
    "--yes",
    "--force",
    ...extra,
  ];
  const { status, out } = runVercel(args);
  if (status !== 0) {
    console.error(out);
    return false;
  }
  return true;
}

/** JSON 등 긴 값은 stdin으로 넘김 (쉘 이스케이프 회피) */
function addSensitiveStdin(name, rawBody, targetEnv) {
  const args = [
    "env",
    "add",
    name,
    targetEnv,
    "--sensitive",
    "--yes",
    "--force",
  ];
  const { status, out } = runVercel(args, { stdin: rawBody });
  if (status !== 0) {
    console.error(out);
    return false;
  }
  return true;
}

function loadServiceAccountJson() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline?.trim()) return inline.trim();
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.join(root, p.replace(/^\.\//, ""));
  if (fs.existsSync(abs)) {
    return fs.readFileSync(abs, "utf8");
  }
  return null;
}

function main() {
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim();
  const serviceJson = loadServiceAccountJson();

  if (!databaseURL || !serviceJson) {
    console.error(
      "필수 값이 없습니다. .env.local 에 다음을 채우세요:\n" +
        "  - FIREBASE_DATABASE_URL (또는 NEXT_PUBLIC_FIREBASE_DATABASE_URL)\n" +
        "  - FIREBASE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS"
    );
    process.exit(1);
  }

  try {
    JSON.parse(serviceJson);
  } catch {
    console.error("서비스 계정 JSON 파싱 실패 (FIREBASE_SERVICE_ACCOUNT_JSON / 키 파일)");
    process.exit(1);
  }

  const clientKeys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
  ];

  for (const envName of TARGET_ENVS) {
    console.log(`\n━━ Vercel 환경: ${envName} ━━`);

    if (!addPlain("FIREBASE_DATABASE_URL", databaseURL, envName)) {
      process.exit(1);
    }
    console.log("  ✓ FIREBASE_DATABASE_URL");

    if (!addSensitiveStdin("FIREBASE_SERVICE_ACCOUNT_JSON", serviceJson, envName)) {
      process.exit(1);
    }
    console.log("  ✓ FIREBASE_SERVICE_ACCOUNT_JSON (sensitive)");

    const rtdRoot = process.env.FIREBASE_EODHD_RTD_ROOT?.trim();
    if (rtdRoot) {
      if (!addPlain("FIREBASE_EODHD_RTD_ROOT", rtdRoot, envName)) process.exit(1);
      console.log("  ✓ FIREBASE_EODHD_RTD_ROOT");
    }

    const somedayRoot = process.env.FIREBASE_SOMEDAYNEWS_RTD_ROOT?.trim();
    if (somedayRoot) {
      if (!addPlain("FIREBASE_SOMEDAYNEWS_RTD_ROOT", somedayRoot, envName)) process.exit(1);
      console.log("  ✓ FIREBASE_SOMEDAYNEWS_RTD_ROOT");
    }

    if (withClient) {
      for (const k of clientKeys) {
        const v = process.env[k]?.trim();
        if (!v) continue;
        if (!addPlain(k, v, envName)) process.exit(1);
        console.log(`  ✓ ${k}`);
      }
    }
  }

  console.log(
    "\n완료. 대시보드에서 확인하거나 `npx vercel env ls` 로 검증한 뒤 재배포하세요."
  );
}

main();
