import type { NativeIntent } from 'expo-router';

/**
 * 從 App Link 打開 App（https://tietie-board.vercel.app/open?join=邀請碼，app.json 的 intentFilters）：
 * 換成首頁加上同樣的參數，跟點通知、小工具一樣由首頁處理，不會多疊一層畫面
 */
export const redirectSystemPath: NativeIntent['redirectSystemPath'] = ({ path }) => {
  try {
    const url = new URL(path, 'tietieboard://app');
    return url.pathname === '/open' ? `/${url.search}` : path;
  } catch {
    return path;
  }
};
