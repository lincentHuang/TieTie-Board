import type { PushOS } from './repo';

/** 網頁版不註冊推播（收不到推播）；要「送」推播請用 push-send.ts，網頁版也可以送 */
export async function getDevicePushTarget(): Promise<{ token: string; os: PushOS } | null> {
  return null;
}
