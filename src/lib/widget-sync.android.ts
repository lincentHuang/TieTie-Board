import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { BoardAndroidWidget } from '@/widgets/android/BoardAndroidWidget';
import { WIDGET_SOURCE_KEY } from '@/widgets/android/task-handler';

import { viewAt, type WidgetSource } from './widget-data';

/** 存下原始資料（背景更新時用），並立刻重畫所有已放在桌面的小工具 */
export async function syncWidget(source: WidgetSource) {
  await AsyncStorage.setItem(WIDGET_SOURCE_KEY, JSON.stringify(source));
  const view = viewAt(source, Date.now());
  await requestWidgetUpdate({
    widgetName: 'BoardWidget',
    renderWidget: (info) => createElement(BoardAndroidWidget, { view, width: info.width, height: info.height }),
  });
}
