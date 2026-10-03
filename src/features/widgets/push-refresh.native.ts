import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { refreshWidgetFromServer } from './refresh';

const TASK = 'widget-push-refresh';

/**
 * 收到推播時（App 在背景、甚至沒開）抓最新資料更新小工具：別人發快速通報或新公告，
 * 大家桌面上的小工具馬上跟著變。要在 index.ts 最上層呼叫，系統在背景叫醒 App 時才找得到這個任務。
 */
export function registerPushRefresh() {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
    // 使用者點了通知（不是收到新通知）→ 交給畫面處理
    if (error || 'actionIdentifier' in data) return Notifications.BackgroundNotificationTaskResult.NoData;
    try {
      await refreshWidgetFromServer();
      return Notifications.BackgroundNotificationTaskResult.NewData;
    } catch (e) {
      console.warn('收到推播後更新小工具失敗', e);
      return Notifications.BackgroundNotificationTaskResult.Failed;
    }
  });
  Notifications.registerTaskAsync(TASK).catch((e) => console.warn('註冊推播背景任務失敗', e));
}
