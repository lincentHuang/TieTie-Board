import { errorMessage } from '@/lib/errors';

// 網頁版：react-native-web 的 Alert 什麼都不會顯示，改用瀏覽器內建的對話框

export const askConfirm = (title: string, message: string) => Promise.resolve(window.confirm(`${title}\n${message}`));

export function showError(title: string, e: unknown) {
  console.warn(title, e);
  window.alert(`${title}\n${errorMessage(e)}`);
}
