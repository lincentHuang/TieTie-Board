import { Alert } from 'react-native';

import { errorMessage } from '@/lib/errors';

export const askConfirm = (title: string, message: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '確定', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );

export function showError(title: string, e: unknown) {
  console.warn(title, e);
  Alert.alert(title, errorMessage(e));
}

/** 一般提示（不是錯誤），例如加入申請有結果了 */
export const showNotice = (title: string, message: string) => Alert.alert(title, message);
