import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseWidgetSource, type BoardPick, type WidgetSource } from '../widget-data';

/** Android 小工具在背景更新時，從這裡讀 App 最後一次存下的資料 */
const SOURCE_KEY = 'widget:source';
/** 每個放在桌面的小工具各自記得停在哪個公布欄（可以放兩個小工具看不同的公布欄） */
const pickKey = (widgetId: number) => `widget:pick:${widgetId}`;
/** 每個小工具固定看哪個公布欄（放到桌面時選的）；沒有 = 全部，用 ‹ › 切換 */
const pinKey = (widgetId: number) => `widget:pin:${widgetId}`;

/** 上次寫入最新資料的時間（App 開著同步、收到推播、按 ↻ 都算），用來決定要不要再去資料庫抓 */
const SYNCED_AT_KEY = 'widget:syncedAt';

export const loadSource = async () => parseWidgetSource(await AsyncStorage.getItem(SOURCE_KEY));
export const saveSource = (source: WidgetSource) =>
  AsyncStorage.multiSet([
    [SOURCE_KEY, JSON.stringify(source)],
    [SYNCED_AT_KEY, String(Date.now())],
  ]);
export const loadSyncedAt = async () => Number(await AsyncStorage.getItem(SYNCED_AT_KEY)) || 0;

export async function loadPick(widgetId: number): Promise<BoardPick | null> {
  try {
    const data: unknown = JSON.parse((await AsyncStorage.getItem(pickKey(widgetId))) ?? 'null');
    if (typeof data === 'object' && data !== null && 'gid' in data && 'at' in data) {
      if (typeof data.gid === 'string' && typeof data.at === 'number') {
        const offset = 'offset' in data && typeof data.offset === 'number' ? data.offset : 0;
        return { gid: data.gid, at: data.at, offset };
      }
    }
  } catch {
    // 壞掉就當作沒選過
  }
  return null;
}

export const savePick = (widgetId: number, pick: BoardPick) => AsyncStorage.setItem(pickKey(widgetId), JSON.stringify(pick));
export const removePick = (widgetId: number) => AsyncStorage.multiRemove([pickKey(widgetId), pinKey(widgetId)]);

export const loadPin = (widgetId: number) => AsyncStorage.getItem(pinKey(widgetId));
export const savePin = (widgetId: number, gid: string | null) =>
  gid ? AsyncStorage.setItem(pinKey(widgetId), gid) : AsyncStorage.removeItem(pinKey(widgetId));
