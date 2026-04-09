import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

/** 브라우저 전용. 값은 .env.local 의 NEXT_PUBLIC_FIREBASE_* 에 두세요. */
export function getFirebaseWebApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  };
  if (!config.apiKey || !config.appId) return null;
  if (getApps().length > 0) {
    return getApps()[0]!;
  }
  return initializeApp(config);
}
