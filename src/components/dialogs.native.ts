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
