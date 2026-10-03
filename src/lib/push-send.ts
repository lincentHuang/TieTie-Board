/** Expo 的推播轉送服務：免費、不需要自己的伺服器，iOS / Android 都由它轉給 Apple / Google */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo 一次最多收 100 則 */
const BATCH = 100;

/** Expo 推播的訊息格式（只列出用得到的欄位） */
export interface PushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'normal' | 'high';
  /** Android 通知頻道（見 push.native.ts 的 ensureChannels） */
  channelId?: string;
  interruptionLevel?: 'active' | 'time-sensitive';
  /** iOS：叫醒在背景的 App 跑背景任務（更新小工具）。只放 data 的推播才保證會叫醒 */
  contentAvailable?: boolean;
}

/**
 * 直接從 App 把推播交給 Expo 轉送（手機、網頁都可以送）。
 * 網頁版：Expo 沒有開放跨網域（CORS），所以用「簡單請求」（text/plain、no-cors）送出，
 * 瀏覽器看不到回應，但 Expo 一樣會收下並轉送。
 */
export async function sendPush(messages: PushMessage[]) {
  for (let i = 0; i < messages.length; i += BATCH) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(messages.slice(i, i + BATCH)),
    });
    if (res.type !== 'opaque' && !res.ok) throw new Error(`推播服務回應 ${res.status}`);
  }
}
