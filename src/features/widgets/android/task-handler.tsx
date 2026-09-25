import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { parseWidgetSource, viewAt } from '../widget-data';
import { BoardAndroidWidget } from './BoardAndroidWidget';

export const WIDGET_SOURCE_KEY = 'widget:source';

/** 系統要求更新小工具時（新增、每 30 分鐘、拉伸大小）在背景執行 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const view = viewAt(parseWidgetSource(await AsyncStorage.getItem(WIDGET_SOURCE_KEY)), Date.now());
  renderWidget(<BoardAndroidWidget view={view} width={widgetInfo.width} height={widgetInfo.height} />);
}
