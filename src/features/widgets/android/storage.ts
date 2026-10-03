import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseWidgetSource, type BoardPick, type WidgetSource } from '../widget-data';

/** Android 小工具在背景更新時，從這裡讀 App 最後一次存下的資料 */
const SOURCE_KEY = 'widget:source';
/** 每個放在桌面的小工具各自記得停在哪個公布欄（可以放兩個小工具看不同的公布欄） */
const pickKey = (widgetId: number) => `widget:pick:${widgetId}`;

export const loadSource = async () => parseWidgetSource(await AsyncStorage.getItem(SOURCE_KEY));
export const saveSource = (source: WidgetSource) => AsyncStorage.setItem(SOURCE_KEY, JSON.stringify(source));

export async function loadPick(widgetId: number): Promise<BoardPick | null> {
  try {
    const data: unknown = JSON.parse((await AsyncStorage.getItem(pickKey(widgetId))) ?? 'null');
    if (typeof data === 'object' && data !== null && 'gid' in data && 'at' in data) {
      if (typeof data.gid === 'string' && typeof data.at === 'number') return { gid: data.gid, at: data.at };
    }
  } catch {
    // 壞掉就當作沒選過
  }
  return null;
}

export const savePick = (widgetId: number, pick: BoardPick) => AsyncStorage.setItem(pickKey(widgetId), JSON.stringify(pick));
export const removePick = (widgetId: number) => AsyncStorage.removeItem(pickKey(widgetId));
