"use client";

import { onValue, ref, set } from "firebase/database";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getFirebaseClientDatabase } from "@/lib/firebase/client-database";
import {
  getMemberPortfolioRtdbPath,
  MAX_MEMBER_PORTFOLIO_TICKERS,
  portfolioTickersFromRtdbVal,
} from "@/lib/firebase/member-portfolio-rtdb";
import {
  normalizeKoreaTickerList,
  parseStoredTickerArrayJson,
  persistTickerArrayJson,
} from "@/lib/korea-ticker";
import { PORTFOLIO_LOCAL_STORAGE_KEY } from "./constants";
import type { PortfolioSyncState } from "./types";

export type UseSyncedPortfolioTickersResult = {
  tickers: string[];
  /** 정규화·저장·RTDB 반영 */
  commitTickers: (next: string[]) => void;
  syncState: PortfolioSyncState;
};

/**
 * 포트폴리오 종목: 로컬 스토리지 + Firebase RTDB 실시간 동기화.
 * RTDB 미설정 시 로컬만 사용.
 */
export function useSyncedPortfolioTickers(): UseSyncedPortfolioTickersResult {
  const [tickers, setTickers] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<PortfolioSyncState>("loading");
  const rtdbPath = useMemo(() => getMemberPortfolioRtdbPath(), []);

  const commitTickers = useCallback(
    (next: string[]) => {
      const clean = normalizeKoreaTickerList(next, { maxCount: MAX_MEMBER_PORTFOLIO_TICKERS });
      setTickers(clean);
      persistTickerArrayJson(PORTFOLIO_LOCAL_STORAGE_KEY, clean);
      const db = getFirebaseClientDatabase();
      if (db) {
        const r = ref(db, rtdbPath);
        set(r, { tickers: clean, updatedAt: Date.now() })
          .then(() => setSyncState("cloud"))
          .catch(() => setSyncState("cloud_error"));
      } else {
        setSyncState("local");
      }
    },
    [rtdbPath]
  );

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    const db = getFirebaseClientDatabase();

    if (!db) {
      const local = parseStoredTickerArrayJson(
        localStorage.getItem(PORTFOLIO_LOCAL_STORAGE_KEY),
        MAX_MEMBER_PORTFOLIO_TICKERS
      );
      setTickers(local);
      setSyncState("local");
      return;
    }

    const r = ref(db, rtdbPath);
    const seed = parseStoredTickerArrayJson(
      localStorage.getItem(PORTFOLIO_LOCAL_STORAGE_KEY),
      MAX_MEMBER_PORTFOLIO_TICKERS
    );
    setTickers(seed);

    unsub = onValue(r, (snap) => {
      if (cancelled) return;
      if (!snap.exists()) {
        const local = parseStoredTickerArrayJson(
          localStorage.getItem(PORTFOLIO_LOCAL_STORAGE_KEY),
          MAX_MEMBER_PORTFOLIO_TICKERS
        );
        setTickers(local);
        persistTickerArrayJson(PORTFOLIO_LOCAL_STORAGE_KEY, local);
        if (local.length > 0) {
          set(r, { tickers: local, updatedAt: Date.now() })
            .then(() => setSyncState("cloud"))
            .catch(() => setSyncState("cloud_error"));
        } else {
          setSyncState("cloud");
        }
        return;
      }
      const raw = snap.val() as { tickers?: unknown; updatedAt?: number };
      const remote = portfolioTickersFromRtdbVal(raw?.tickers);
      setTickers(remote);
      persistTickerArrayJson(PORTFOLIO_LOCAL_STORAGE_KEY, remote);
      setSyncState("cloud");
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [rtdbPath]);

  return { tickers, commitTickers, syncState };
}
