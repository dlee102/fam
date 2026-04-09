import {
  getFirebaseDatabase,
  isFirebaseRtdbConfigured,
} from "@/lib/firebase/admin-app";

/** RTDB 루트 아래에 로컬 `data/eodhd_news_windows` 와 동일한 트리를 두면 됨 (기본 키 이름). */
export function getEodhdRtdbRoot(): string {
  return process.env.FIREBASE_EODHD_RTD_ROOT ?? "eodhd_news_windows";
}

function relativePathToRefKey(relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, "").replace(/\/+$/, "");
  const parts = rel.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1]!;
  if (last.endsWith(".json")) {
    parts[parts.length - 1] = last.slice(0, -5);
  }
  return parts.join("/");
}

export async function fetchEodhdJsonFromRtdb<T>(
  relativePathFromEodRoot: string
): Promise<T | null> {
  if (!isFirebaseRtdbConfigured()) return null;
  const key = relativePathToRefKey(relativePathFromEodRoot);
  if (!key) return null;
  try {
    const db = getFirebaseDatabase();
    const snap = await db.ref(`${getEodhdRtdbRoot()}/${key}`).once("value");
    const v = snap.val();
    if (v === null || v === undefined) return null;
    return v as T;
  } catch {
    return null;
  }
}
