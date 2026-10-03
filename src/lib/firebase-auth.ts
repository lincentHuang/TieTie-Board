import { FirebaseError, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  initializeAuth,
  linkWithPopup,
  signInWithCredential,
  type Auth,
  type User,
} from 'firebase/auth';

// 網頁版：登入狀態存在瀏覽器 localStorage；用 initializeAuth 時要自己帶彈出視窗的處理器，Google 登入才能用
export const createAuth = (app: FirebaseApp) =>
  initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });

/**
 * Google 登入是備案（給在電腦上看、或沒有 LINE 的人）。
 * LINE 內建瀏覽器裡 Google 不給登入（會顯示 disallowed_useragent），那裡本來就用 LINE 登入，所以不顯示。
 */
export const canLoginWithGoogle = () => !/ Line\//i.test(navigator.userAgent);

const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

/** 綁定成功 = linked（uid 不變）；這個 Google 帳號已經是別的 uid = switchAccount（呼叫的人搬完成員資料再切換過去） */
export type GoogleLink = { linked: User } | { switchAccount: () => Promise<User> };

/**
 * 用 Google 登入：把目前的帳號綁上 Google；使用者關掉視窗回傳 null。
 * 用彈出視窗：網站不在 Firebase 的網域上，換頁的方式在 Safari / Chrome 擋第三方 Cookie 時會失敗。
 * 要在按鈕的 onPress 裡直接呼叫（中間不能先 await），不然瀏覽器會擋下彈出視窗。
 */
export async function linkGoogle(auth: Auth, user: User): Promise<GoogleLink | null> {
  try {
    const cred = await linkWithPopup(user, new GoogleAuthProvider());
    return { linked: cred.user };
  } catch (e) {
    if (e instanceof FirebaseError && CANCELLED.includes(e.code)) return null;
    const credential =
      e instanceof FirebaseError && e.code === 'auth/credential-already-in-use'
        ? GoogleAuthProvider.credentialFromError(e)
        : null;
    if (!credential) throw e;
    return { switchAccount: () => signInWithCredential(auth, credential).then((c) => c.user) };
  }
}
