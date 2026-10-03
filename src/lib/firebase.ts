import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { createAuth } from './firebase-auth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** 設 EXPO_PUBLIC_FIREBASE_EMULATOR_HOST（例如 127.0.0.1）就改連本機模擬器，方便開發測試 */
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;

export const firebaseConfigured = Boolean(config.projectId && (config.apiKey || emulatorHost));

const app = getApps()[0] ?? initializeApp(firebaseConfigured ? config : { projectId: 'demo-unconfigured', apiKey: 'x' });

export const auth = createAuth(app);
export const db = getFirestore(app);

if (emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}

/** 已經登入過才回傳 uid，不會建立新帳號（背景任務用：新帳號不是任何群組的成員，什麼都讀不到） */
export async function signedInUid(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser?.uid ?? null;
}

/** 匿名登入，回傳 uid（重開 App 會沿用同一個帳號） */
export async function ensureSignedIn(): Promise<string> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

/** 目前登入的帳號；lineSub = 綁定的 LINE 使用者 ID（/api/line-login 發憑證時寫進去的），匿名帳號是 null */
export async function currentAccount() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  // 登入憑證過期又沒網路時讀不到，當作沒綁 LINE（只影響設定畫面要不要問暱稱），App 照常打開
  const claims = await user.getIdTokenResult().then(
    (r): Record<string, unknown> => r.claims,
    (): Record<string, unknown> => ({}),
  );
  return {
    uid: user.uid,
    anonymous: user.isAnonymous,
    lineSub: typeof claims.lineSub === 'string' ? claims.lineSub : null,
  };
}

/**
 * 把 LINE 的 ID token 交給伺服器（Vercel 上的 /api/line-login）驗證，換一張 Firebase 登入憑證。
 * 目前是匿名帳號的話一起送過去，第一次綁 LINE 時沿用同一個 uid，原本的公布欄、便利貼都會留著。
 */
export async function exchangeLineToken(lineIdToken: string) {
  const user = auth.currentUser;
  const firebaseIdToken = user?.isAnonymous ? await user.getIdToken() : undefined;
  const res = await fetch('/api/line-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: lineIdToken, firebaseIdToken }),
  });
  const data: unknown = await res.json().catch(() => null);
  const body = isRecord(data) ? data : {};
  if (!res.ok || typeof body.token !== 'string' || typeof body.uid !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : `LINE 登入失敗（${res.status}）`);
  }
  return { token: body.token, uid: body.uid };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export async function signInWithToken(token: string) {
  const cred = await signInWithCustomToken(auth, token);
  return cred.user.uid;
}
