import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, signInAnonymously, signInWithCustomToken, type User } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';

import { postApi } from './api';
import { canLoginWithGoogle, createAuth, linkGoogle } from './firebase-auth';
import { firestoreSettings } from './firebase-cache';

export { canLoginWithGoogle };

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

const existing = getApps()[0];
const app = existing ?? initializeApp(firebaseConfigured ? config : { projectId: 'demo-unconfigured', apiKey: 'x' });

export const auth = createAuth(app);
// 開發時重新整理模組會再跑一次，已經初始化過就直接拿
export const db = existing ? getFirestore(app) : initializeFirestore(app, firestoreSettings);

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

/** LINE / Google 給的名字和大頭貼（還沒整理成成員資料） */
export interface RawProfile {
  name: string | null;
  photoURL: string | null;
}

const googleOf = (user: User): RawProfile | null => {
  const p = user.providerData.find((d) => d.providerId === 'google.com');
  return p ? { name: p.displayName, photoURL: p.photoURL } : null;
};

/**
 * 目前登入的帳號。
 * lineSub = 綁定的 LINE 使用者 ID（/api/line-login 發憑證時寫進去的）；google = 綁定的 Google 帳號；都沒有就是匿名
 */
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
    google: googleOf(user),
  };
}

/**
 * 用 Google 登入（要在按鈕的 onPress 裡直接呼叫，見 linkGoogle）；使用者取消回傳 null。
 * - linked：目前的帳號綁上 Google，uid 不變
 * - switchAccount：這個 Google 帳號在別台裝置用過，呼叫的人搬完成員資料再切換過去
 */
export async function googleLogin() {
  const user = auth.currentUser;
  if (!user) throw new Error('還沒登入，請重新整理再試一次');
  const { uid, isAnonymous } = user;
  const result = await linkGoogle(auth, user);
  if (!result) return null;
  if ('linked' in result) return { uid, anonymous: isAnonymous, google: googleOf(result.linked), switchAccount: null };
  const switchAccount = () => result.switchAccount().then((u) => ({ uid: u.uid, google: googleOf(u) }));
  return { uid, anonymous: isAnonymous, google: null, switchAccount };
}

/**
 * 把 LINE 的 ID token 交給伺服器（Vercel 上的 /api/line-login）驗證，換一張 Firebase 登入憑證。
 * 目前是匿名帳號的話一起送過去，第一次綁 LINE 時沿用同一個 uid，原本的公布欄、便利貼都會留著。
 */
export async function exchangeLineToken(lineIdToken: string) {
  const user = auth.currentUser;
  const firebaseIdToken = user?.isAnonymous ? await user.getIdToken() : undefined;
  const body = await postApi('/api/line-login', { idToken: lineIdToken, firebaseIdToken }, 'LINE 登入失敗');
  if (typeof body.token !== 'string' || typeof body.uid !== 'string') throw new Error('LINE 登入失敗，請稍後再試');
  return { token: body.token, uid: body.uid };
}

/**
 * 用 LINE 登入的人點邀請連結：請伺服器（Vercel 上的 /api/join）確認他在不在這個公布欄綁定的 LINE 群組裡，
 * 在的話伺服器直接把他加成成員，回傳 true；不在（或還沒綁定群組）回傳 false，改成送出申請等房主同意。
 */
export async function joinWithLineGroup(gid: string, profile: { name: string; avatarUrl: string | null }) {
  const user = auth.currentUser;
  if (!user) throw new Error('還沒登入，請重新整理再試一次');
  const body = await postApi('/api/join', { idToken: await user.getIdToken(), code: gid, ...profile }, '加入失敗');
  return body.joined === true;
}

export async function signInWithToken(token: string) {
  const cred = await signInWithCustomToken(auth, token);
  return cred.user.uid;
}
