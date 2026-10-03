import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, signInAnonymously } from 'firebase/auth';
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
