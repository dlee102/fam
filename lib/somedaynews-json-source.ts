/**
 * SomedayNews 메타 배열: Firebase RTDB만 사용. Admin 미설정 시 빈 배열.
 * 노드: `{FIREBASE_SOMEDAYNEWS_RTD_ROOT}/somedaynews_article_tickers`
 */

import { isFirebaseRtdbConfigured } from "@/lib/firebase/admin-app";
import { fetchSomedaynewsArticleTickersValFromRtdb } from "@/lib/firebase/rtdb-somedaynews";

export interface SomedayNewsArticleRecord {
  date: string;
  published_at: string;
  article_id: string;
  title: string;
  stock_codes: string[];
  registered_date: string;
  /** SomeDayNews API 무료 전환 시각(ISO); 없으면 null 또는 생략 */
  free_conversion_at?: string | null;
  /**
   * 팜이데일리 API 기사 노출 점수(정수 문자열에서 파싱). 클수록 좋음. 미부여·빈 값은 null.
   */
  score?: number | null;
}

function normalizeRecordsFromRtdb(raw: unknown): SomedayNewsArticleRecord[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((r) => r && typeof r === "object") as SomedayNewsArticleRecord[];
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    return keys
      .map((k) => o[k])
      .filter((r): r is SomedayNewsArticleRecord => Boolean(r && typeof r === "object"));
  }
  return [];
}

/** RTDB만. `FIREBASE_DATABASE_URL`+서비스 계정 없으면 `[]`. */
export async function loadSomedaynewsArticleTickersRecords(): Promise<SomedayNewsArticleRecord[]> {
  if (!isFirebaseRtdbConfigured()) {
    return [];
  }
  const val = await fetchSomedaynewsArticleTickersValFromRtdb();
  return normalizeRecordsFromRtdb(val);
}
