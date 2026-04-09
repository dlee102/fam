"use client";

import { useEffect } from "react";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirebaseWebApp } from "@/lib/firebase/client-app";

/** measurementId 가 있을 때만 Analytics 초기화 */
export function FirebaseAnalyticsInit() {
  useEffect(() => {
    const app = getFirebaseWebApp();
    if (!app) return;
    void isSupported().then((ok) => {
      if (ok) getAnalytics(app);
    });
  }, []);
  return null;
}
