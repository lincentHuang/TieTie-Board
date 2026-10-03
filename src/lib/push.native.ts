import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PushOS } from './repo';

/** Android 通知頻道：快速通報最醒目、新公告次之（頻道建立後就不能再改重要程度） */
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('alerts', {
      name: '快速通報',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('board', {
      name: '新公告',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }),
  ]);
}

/** EAS 專案 ID：`npx eas-cli@latest init` 後會寫進 app.json，Expo 推播要靠它 */
function easProjectId() {
  const fromConfig: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas: unknown = Constants.easConfig?.projectId;
  if (typeof fromConfig === 'string') return fromConfig;
  return typeof fromEas === 'string' ? fromEas : null;
}

/** 這台裝置的推播代碼；沒有通知權限、在 Expo Go 裡、或還沒設定 EAS 專案時回傳 null */
export async function getDevicePushTarget(): Promise<{ token: string; os: PushOS } | null> {
  if (isRunningInExpoGo()) return null;
  const projectId = easProjectId();
  if (!projectId) {
    console.warn('還沒設定 EAS 專案（npx eas-cli@latest init），這台裝置收不到推播');
    return null;
  }
  await ensureChannels();
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, os: Platform.OS === 'ios' ? 'ios' : 'android' };
}
