import * as Notifications from 'expo-notifications';

import { whenLabel } from './dates';
import { itemTitle, type BoardItem } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const HOUR = 3_600_000;
/** iOS 最多只能排 64 個本機通知，留一點空間 */
const MAX_SCHEDULED = 60;

let lastSignature = '';

/** 依照白板上有日期的項目，重新排好提醒：前一天、前一小時、準時 */
export async function syncReminders(items: BoardItem[]) {
  const now = Date.now();
  const plan = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt > now)
    .flatMap((i) => {
      const title = itemTitle(i);
      const prefix = i.priority === 'urgent' ? '⚠️ ' : '📅 ';
      return [
        { at: i.dueAt - 24 * HOUR, title: `${prefix}明天：${title}`, body: whenLabel(i.dueAt, i.dueAt - 24 * HOUR) },
        { at: i.dueAt - HOUR, title: `${prefix}一小時後：${title}`, body: whenLabel(i.dueAt, i.dueAt - HOUR) },
        { at: i.dueAt, title: `${prefix}現在：${title}`, body: '時間到了！' },
      ];
    })
    .filter((r) => r.at > now + 30_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED);

  const signature = JSON.stringify(plan);
  if (signature === lastSignature) return;
  lastSignature = signature;

  if (plan.length > 0) {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return;
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, sound: true, interruptionLevel: 'timeSensitive' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
    });
  }
}
