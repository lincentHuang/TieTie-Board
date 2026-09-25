import 'expo-router/entry';

import { Platform } from 'react-native';

// Android 桌面小工具在背景更新時，需要一個不依賴畫面的 JS 任務
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/features/widgets/android/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
