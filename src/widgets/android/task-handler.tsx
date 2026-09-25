import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { viewAt, type WidgetSource } from '@/lib/widget-data';

import { BoardAndroidWidget } from './BoardAndroidWidget';

export const WIDGET_SOURCE_KEY = 'widget:source';

export async function loadWidgetSource(): Promise<WidgetSource> {
  const raw = await AsyncStorage.getItem(WIDGET_SOURCE_KEY);
  return raw ? JSON.parse(raw) : { groupName: '公布欄', pending: [], events: [] };
}

/** 系統要求更新小工具時（新增、每 30 分鐘、拉伸大小）在背景執行 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const view = viewAt(await loadWidgetSource(), Date.now());
  renderWidget(<BoardAndroidWidget view={view} width={widgetInfo.width} height={widgetInfo.height} />);
}
