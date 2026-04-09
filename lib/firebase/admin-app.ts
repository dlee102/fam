import admin from "firebase-admin";

/**
 * 서버 전용. RTDB 읽기/쓰기는 Admin SDK가 보안 규칙을 우회합니다.
 * 배포 환경: FIREBASE_DATABASE_URL + FIREBASE_SERVICE_ACCOUNT_JSON(또는 ADC).
 */

export function isFirebaseRtdbConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_DATABASE_URL &&
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error("FIREBASE_DATABASE_URL is not set");
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
