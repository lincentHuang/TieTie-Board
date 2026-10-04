import { errorMessage } from '@/lib/errors';

// 網頁版：react-native-web 的 Alert 什麼都不會顯示，改用瀏覽器內建的對話框

export const askConfirm = (title: string, message: string) => Promise.resolve(window.confirm(`${title}\n${message}`));

export function showError(title: string, e: unknown) {
  console.warn(title, e);
  window.alert(`${title}\n${errorMessage(e)}`);
}

/** 一般提示（不是錯誤），例如加入申請有結果了 */
export const showNotice = (title: string, message: string) => window.alert(`${title}\n${message}`);
