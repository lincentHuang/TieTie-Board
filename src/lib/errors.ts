/** 把錯誤轉成給使用者看的中文訊息；Firebase 常見的錯誤代碼換成白話 */
export function errorMessage(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
  if (code === 'permission-denied') return '沒有權限，可能已經不在這個群組了';
  if (code === 'unavailable' || code === 'auth/network-request-failed') return '連不上網路，請稍後再試';
  if (code === 'auth/popup-blocked') return '瀏覽器擋住了登入視窗，請允許這個網站開彈出視窗再試一次';
  if (code === 'auth/unauthorized-domain') return '這個網址還沒加進 Firebase 的授權網域（見 README 的 Google 登入設定）';
  if (code === 'auth/operation-not-allowed') return 'Firebase 還沒開啟 Google 登入（見 README 的 Google 登入設定）';
  return e instanceof Error ? e.message : String(e);
}
