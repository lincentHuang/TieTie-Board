import 'expo-router/entry';

import { Platform } from 'react-native';

import { registerPushRefresh } from './src/features/widgets/push-refresh';

// 收到推播時在背景更新桌面小工具；要在最上層註冊，系統在背景叫醒 App 時才找得到這個任務
registerPushRefresh();

// Android 桌面小工具在背景更新時，需要一個不依賴畫面的 JS 任務
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/features/widgets/android/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
