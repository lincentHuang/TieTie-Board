import { openAppLink, openInExternalBrowser } from '@/lib/liff';

import { detectInstallEnv, type InstallEnv } from './install-env';

/** Chrome 的「可以安裝了」事件（TypeScript 內建的型別還沒有） */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** public/index.html 一開始就接住的安裝事件 */
    __installPrompt?: InstallPromptEvent;
  }
}

/** Android App 的下載網址（APK）；沒設定就只提供「加到主畫面」 */
export const APK_URL = process.env.EXPO_PUBLIC_ANDROID_APK_URL ?? '';

/** 網頁版：在哪種裝置、是不是已經裝好了（手機 App 版是 null，本來就裝好了） */
export function installEnv(): InstallEnv | null {
  const nav: Navigator & { standalone?: boolean } = navigator;
  return detectInstallEnv({
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  });
}

/** 瀏覽器願意直接跳出安裝視窗（Android 的 Chrome、電腦版 Chrome / Edge；iPhone 沒有，要手動加到主畫面） */
export const canPromptInstall = () => Boolean(window.__installPrompt);

/** 安裝事件來了或裝好了時通知；回傳取消訂閱 */
export function onInstallPromptChange(cb: () => void) {
  window.addEventListener('beforeinstallprompt', cb);
  window.addEventListener('appinstalled', cb);
  return () => {
    window.removeEventListener('beforeinstallprompt', cb);
    window.removeEventListener('appinstalled', cb);
  };
}

/** 跳出瀏覽器的安裝視窗；每個事件只能用一次，用完瀏覽器之後會再發新的 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = window.__installPrompt;
  if (!event) return 'unavailable';
  window.__installPrompt = undefined;
  await event.prompt();
  return (await event.userChoice).outcome;
}

export function downloadApk() {
  window.location.href = APK_URL;
}

/** 離開 LINE，用手機的瀏覽器打開公布欄（才能安裝） */
export function openInBrowser() {
  const url = `${window.location.origin}/`;
  // LIFF 裡用 LINE 提供的方法；一般的 LINE 內建瀏覽器看得懂網址上的 openExternalBrowser=1
  if (!openInExternalBrowser(url)) window.location.href = `${url}?openExternalBrowser=1`;
}

/** 在 LINE 裡、Android 手機、有 Android App 可以下載：可以改用 App 打開 */
export const canOpenInApp = (env: InstallEnv | null) => Boolean(env?.inLine && env.platform === 'android' && APK_URL);

/** 會被 Android App 接走的網址（app.json 的 intentFilters 只認 /open 開頭；帶著邀請碼，App 裡沒加入過就送出申請） */
function appUrl(code: string | null) {
  const url = new URL('/open', window.location.origin);
  if (code) url.searchParams.set('join', code);
  return url;
}

/** 一打開就交給 App：只在 LIFF 裡做（換網址會打斷正在進行的 LINE 登入）；做不到回傳 false */
export const handOffToApp = (code: string | null) => openAppLink(appUrl(code).href);

/** 按「用 App 打開」：沒裝 App 的話會用手機的瀏覽器打開 */
export async function openInApp(code: string | null) {
  if (await handOffToApp(code)) return;
  // 不是從 LIFF 打開的一般 LINE 內建瀏覽器：一樣用網址上的 openExternalBrowser=1 交給手機
  const url = appUrl(code);
  url.searchParams.set('openExternalBrowser', '1');
  window.location.href = url.href;
}

/** iPhone 在 LINE 裡加入公布欄後的提醒：主畫面上的公布欄沒辦法從 LINE 直接打開，但登入同一個帳號就看得到 */
export function homeScreenNote() {
  const env = installEnv();
  return env?.inLine && env.platform === 'ios'
    ? '有把公布欄加到 iPhone 主畫面的話，從主畫面打開也看得到（要用同一個 LINE 帳號登入）'
    : null;
}
