import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/** 點了快速通報 / 新公告的通知：打開通知所屬的公布欄（推播 data.gid，見 alerts/notify.ts） */
export function useOpenFromNotification() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const gid: unknown = response.notification.request.content.data?.gid;
      if (typeof gid === 'string') router.navigate({ pathname: '/', params: { board: gid } });
    };
    // App 原本沒開、是點通知打開的
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
