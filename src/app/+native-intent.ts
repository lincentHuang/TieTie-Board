import type { NativeIntent } from 'expo-router';

/**
 * 從 App Link 打開 App（https://tietie-board.vercel.app/open?join=邀請碼，app.json 的 intentFilters）：
 * 換成首頁加上同樣的參數，跟點通知、小工具一樣由首頁處理，不會多疊一層畫面。
 * 用 LINE / Google 登入完跳回 App（tietieboard://oauth?code=…）：登入流程自己會接住（src/lib/oauth.ts），
 * 這裡不換畫面；App 在登入途中被系統關掉、重新打開時，登入已經接不上了，就打開首頁
 */
export const redirectSystemPath: NativeIntent['redirectSystemPath'] = ({ path, initial }) => {
  try {
    const url = new URL(path, 'tietieboard://app');
    if (url.pathname === '/open') return `/${url.search}`;
    if (url.protocol === 'tietieboard:' && (url.hostname === 'oauth' || url.pathname === '/oauth')) {
      return initial ? '/' : null;
    }
    return path;
  } catch {
    return path;
  }
};
