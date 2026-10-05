import { Platform } from 'react-native';

/** 網站網址：手機 App 呼叫伺服器函式（api/）、打開登入頁時用；網頁版直接用同一個網站的相對路徑 */
export const SITE_URL = 'https://tietie-board.vercel.app';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 呼叫網站自己的伺服器函式；失敗時用伺服器給的中文訊息 */
export async function postApi(path: string, payload: Record<string, unknown>, failure: string) {
  const res = await fetch(Platform.OS === 'web' ? path : `${SITE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: unknown = await res.json().catch(() => null);
  const body = isRecord(data) ? data : {};
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `${failure}（${res.status}）`);
  return body;
}
