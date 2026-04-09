import {
  getFirebaseDatabase,
  isFirebaseRtdbConfigured,
} from "@/lib/firebase/admin-app";

/** RTDB 루트 아래 `somedaynews_article_tickers` 키에 배열을 둡니다 (sync 스크립트와 동일). */
export function getSomedaynewsRtdbRoot(): string {
  return process.env.FIREBASE_SOMEDAYNEWS_RTD_ROOT ?? "somedaynews";
}

function refPath(): string {
  const root = getSomedaynewsRtdbRoot().replace(/^\/+|\/+$/g, "");
  return `${root}/somedaynews_article_tickers`;
}

/** RTDB에 저장된 SomedayNews 배열 원본(null = 없음/실패). */
export async function fetchSomedaynewsArticleTickersValFromRtdb(): Promise<unknown | null> {
  if (!isFirebaseRtdbConfigured()) return null;
  try {
    const db = getFirebaseDatabase();
    const snap = await db.ref(refPath()).once("value");
    const v = snap.val();
    if (v === null || v === undefined) return null;
    return v;
  } catch {
    return null;
  }
}
