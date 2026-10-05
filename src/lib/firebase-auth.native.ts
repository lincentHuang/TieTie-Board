import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError, type FirebaseApp } from 'firebase/app';
import {
  // firebase/auth 的型別沒有列出 RN 專用 API，但 Metro 會解析到 RN 版本
  // @ts-expect-error getReactNativePersistence 只存在於 React Native 版本
  getReactNativePersistence,
  GoogleAuthProvider,
  initializeAuth,
  linkWithCredential,
  signInWithCredential,
  type Auth,
  type User,
} from 'firebase/auth';

import { oauthLogin } from './oauth';

// 手機版：登入狀態存在 AsyncStorage，重開 App 不會變成新成員
export const createAuth = (app: FirebaseApp) =>
  initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// 手機 App 版：Firebase 的 Google 彈出視窗只能在網頁用，改用系統瀏覽器登入 Google 拿 ID token（見 oauth.ts）
export const canLoginWithGoogle = () => true;

export type GoogleLink = { linked: User } | { switchAccount: () => Promise<User> };

/** 用 Google 登入：把目前的帳號綁上 Google；使用者取消回傳 null（跟網頁版的 linkGoogle 一樣） */
export async function linkGoogle(auth: Auth, user: User): Promise<GoogleLink | null> {
  const login = await oauthLogin('google');
  if (!login) return null;
  const credential = GoogleAuthProvider.credential(login.idToken);
  try {
    const cred = await linkWithCredential(user, credential);
    return { linked: cred.user };
  } catch (e) {
    if (!(e instanceof FirebaseError && e.code === 'auth/credential-already-in-use')) throw e;
    // 這個 Google 帳號在別台裝置用過：搬完成員資料再切換過去
    const existing = GoogleAuthProvider.credentialFromError(e) ?? credential;
    return { switchAccount: () => signInWithCredential(auth, existing).then((c) => c.user) };
  }
}
