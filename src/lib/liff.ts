import liff from '@line/liff';

import { LIFF_ID, type LineIdentity } from './line';

/** 網頁版：在 LINE 裡打開時自動用 LINE 帳號登入（手機 App 版見 liff.native.ts） */
export const canLoginWithLine = Boolean(LIFF_ID);

let initialized = false;
let initializing: Promise<void> | null = null;

function init() {
  // 是點 LINE 邀請連結進來的（網址上有 liff.state）：在一般瀏覽器打開也直接帶去 LINE 登入
  const viaLink = new URLSearchParams(window.location.search).has('liff.state');
  initializing ??= liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: viaLink }).then(() => {
    initialized = true;
  });
  return initializing;
}

/** 已經登入 LINE 就回傳 LINE 身分；沒設定、沒登入或 LIFF 打不開（例如本機開發）都回傳 null，改用匿名登入 */
export async function lineIdentity(): Promise<LineIdentity | null> {
  if (!canLoginWithLine) return null;
  await init();
  if (!liff.isLoggedIn()) return null;
  const idToken = liff.getIDToken();
  const decoded = liff.getDecodedIDToken();
  // 頻道沒開 openid 權限時拿不到 ID token
  if (!idToken || !decoded?.sub) return null;
  return { idToken, sub: decoded.sub, name: decoded.name?.trim() || null, avatarUrl: decoded.picture ?? null };
}

/** 在一般瀏覽器按「用 LINE 登入」：跳到 LINE 登入頁，登入完回到同一頁 */
export async function loginWithLine() {
  await init();
  liff.login({ redirectUri: window.location.href });
}

/** 換 Firebase 登入失敗（例如外部瀏覽器存的 LINE 登入過期）：清掉，下次重新登入 LINE */
export function forgetLineLogin() {
  if (initialized && !liff.isInClient()) liff.logout();
}

/** 在 LINE 裡打開、且頻道有開分享功能時，可以直接選聊天室把邀請傳出去 */
export const canShareToLine = () => initialized && liff.isApiAvailable('shareTargetPicker');

/** 傳到 LINE 聊天室；使用者取消時回傳 false */
export async function shareToLine(text: string) {
  const res = await liff.shareTargetPicker([{ type: 'text', text }]);
  return Boolean(res);
}

/** 在 LINE 裡打開時，改用手機的瀏覽器打開網址（LINE 裡不能安裝到主畫面、下載 App）；不在 LINE 裡回傳 false */
export function openInExternalBrowser(url: string) {
  if (!initialized || !liff.isInClient()) return false;
  liff.openWindow({ url, external: true });
  return true;
}
