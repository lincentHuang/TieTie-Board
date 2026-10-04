import { openInExternalBrowser } from '@/lib/liff';

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
