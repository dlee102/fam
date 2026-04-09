import admin from "firebase-admin";

/**
 * 서버 전용. RTDB 읽기/쓰기는 Admin SDK가 보안 규칙을 우회합니다.
 * DB URL: FIREBASE_DATABASE_URL 우선, 없으면 NEXT_PUBLIC_FIREBASE_DATABASE_URL(로컬에서 자주 동일 값만 넣는 경우).
 * 자격 증명: FIREBASE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS(ADC).
 */

export function getFirebaseDatabaseUrlForAdmin(): string | undefined {
  const a = process.env.FIREBASE_DATABASE_URL?.trim();
  const b = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim();
  return a || b || undefined;
}

export function isFirebaseRtdbConfigured(): boolean {
  return Boolean(
    getFirebaseDatabaseUrlForAdmin() &&
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const databaseURL = getFirebaseDatabaseUrlForAdmin();
  if (!databaseURL) {
    throw new Error(
      "Firebase Database URL이 없습니다. FIREBASE_DATABASE_URL 또는 NEXT_PUBLIC_FIREBASE_DATABASE_URL을 설정하세요."
    );
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const cred = JSON.parse(json) as admin.ServiceAccount;
    return admin.initializeApp({
      credential: admin.credential.cert(cred),
      databaseURL,
    });
  }
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL,
  });
}

export function getFirebaseDatabase(): admin.database.Database {
  return getFirebaseAdminApp().database();
}
