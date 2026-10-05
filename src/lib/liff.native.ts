import type { LineIdentity } from './line';
import { oauthLogin } from './oauth';

// 手機 App 版：LIFF 只能在網頁（LINE 內建瀏覽器）裡用，App 改成按「用 LINE 登入」時用系統瀏覽器登入 LINE（見 oauth.ts）
export const canLoginWithLine = true;

/** App 打開時不會自動登入 LINE（之前登入過的話 Firebase 還記得，照樣是同一個人） */
export const lineIdentity = async (): Promise<LineIdentity | null> => null;

/** 用 LINE 登入，回傳 LINE 身分；使用者取消回傳 null */
export async function loginWithLine(): Promise<LineIdentity | null> {
  const login = await oauthLogin('line');
  return login && { idToken: login.idToken, sub: login.sub, name: login.name, avatarUrl: login.picture };
}

export const forgetLineLogin = () => {};

export const canShareToLine = () => false;

export const shareToLine = async (_text: string) => false;

export const openInExternalBrowser = (_url: string) => false;

export const openAppLink = async (_url: string) => false;
