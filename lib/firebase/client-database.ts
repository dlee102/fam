import { getDatabase, type Database } from "firebase/database";
import { getFirebaseWebApp } from "./client-app";

/** 브라우저 RTDB. `NEXT_PUBLIC_FIREBASE_DATABASE_URL` 필수. */
export function getFirebaseClientDatabase(): Database | null {
  const app = getFirebaseWebApp();
  if (!app) return null;
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "";
  if (!url.trim()) return null;
  try {
    return getDatabase(app);
  } catch {
    return null;
  }
}
