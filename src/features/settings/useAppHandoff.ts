import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { canOpenInApp, handOffToApp, installEnv } from './install';

/** 選了「以後點 LINE 裡的連結，直接用 App 打開」（記在這支手機的 LINE 裡） */
const AUTO_KEY = 'openInApp';

export const loadAutoOpen = () =>
  AsyncStorage.getItem(AUTO_KEY)
    .then((v) => v === '1')
    .catch(() => false);

export function saveAutoOpen(on: boolean) {
  (on ? AsyncStorage.setItem(AUTO_KEY, '1') : AsyncStorage.removeItem(AUTO_KEY)).catch((e) =>
    console.warn('儲存「用 App 打開」設定失敗', e),
  );
}

/** checking：還在看要不要交給 App；opened：已經交給 App 了；stay：照常在這裡打開 */
export type Handoff = 'checking' | 'opened' | 'stay';

/**
 * 在 LINE 裡（Android）點了連結，而且之前選了以後直接用 App 打開：一打開就交給 App（帶著邀請碼）。
 * 交出去之後這裡不加入公布欄，免得多一個用 LINE 身分加入的自己；App 沒打開（還沒裝、LINE 太舊）可以在這裡繼續
 */
export function useAppHandoff(code: string | null) {
  const [state, setState] = useState<Handoff>(() => (canOpenInApp(installEnv()) ? 'checking' : 'stay'));
  // 只交一次（開發模式會把 effect 跑兩次，App 不要被叫起來兩次）
  const started = useRef(false);

  useEffect(() => {
    if (state !== 'checking' || started.current) return;
    started.current = true;
    (async () => {
      const opened = (await loadAutoOpen()) && (await handOffToApp(code).catch(() => false));
      setState(opened ? 'opened' : 'stay');
    })();
  }, [state, code]);

  return {
    state,
    stay: () => setState('stay'),
    stopAuto: () => {
      saveAutoOpen(false);
      setState('stay');
    },
  };
}
