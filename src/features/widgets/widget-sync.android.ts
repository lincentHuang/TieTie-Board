import { createElement } from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { BoardAndroidWidget } from './android/BoardAndroidWidget';
import { loadPick, loadPin, saveSource } from './android/storage';
import { pinSource, viewAt, type WidgetSource } from './widget-data';

/**
 * 存下原始資料（背景更新時用），並立刻重畫所有已放在桌面的小工具。
 * 每個小工具停在自己選的公布欄；沒選過的跟著 App 目前打開的公布欄（currentGid）。
 * 放到桌面時固定了某個公布欄的小工具，只顯示那個公布欄。
 */
export async function syncWidget(source: WidgetSource, currentGid?: string) {
  await saveSource(source);
  const now = Date.now();
  await requestWidgetUpdate({
    widgetName: 'BoardWidget',
    renderWidget: async (info) => {
      const [saved, pin] = await Promise.all([loadPick(info.widgetId), loadPin(info.widgetId)]);
      const pick = saved ?? (currentGid ? { gid: currentGid, at: 0 } : null);
      return createElement(BoardAndroidWidget, {
        view: viewAt(pinSource(source, pin), now, pick),
        width: info.width,
        height: info.height,
      });
    },
  });
}
