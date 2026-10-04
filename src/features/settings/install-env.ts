/** 網頁版在什麼裝置上打開，決定怎麼教使用者把公布欄裝到手機 */
export type InstallPlatform = 'android' | 'ios' | 'desktop';

export interface InstallEnv {
  platform: InstallPlatform;
  /** 已經是從主畫面打開的（裝好了） */
  standalone: boolean;
  /** 在 LINE 的內建瀏覽器裡：不能安裝到主畫面、也不能下載 App，要先換成手機的瀏覽器 */
  inLine: boolean;
}

export function detectInstallEnv({
  userAgent,
  maxTouchPoints,
  standalone,
}: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}): InstallEnv {
  // iPad 的 Safari 會假裝自己是 Mac，用觸控點數分辨
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const platform: InstallPlatform = ios ? 'ios' : /Android/.test(userAgent) ? 'android' : 'desktop';
  return { platform, standalone, inLine: /\bLine\//i.test(userAgent) };
}
