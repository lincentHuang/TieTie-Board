/** 把錯誤轉成給使用者看的中文訊息；Firebase 常見的錯誤代碼換成白話 */
export function errorMessage(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
  if (code === 'permission-denied') return '沒有權限，可能已經不在這個群組了';
  if (code === 'unavailable' || code === 'auth/network-request-failed') return '連不上網路，請稍後再試';
  return e instanceof Error ? e.message : String(e);
}
