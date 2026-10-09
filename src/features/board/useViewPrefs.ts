import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { GROUP_OPTIONS, type QueueGroup } from './queue-filter';

/** swipe = 像網頁一樣上下捲、依日期排（預設）、free = 自由擺放、queue = 排隊 */
export type ViewMode = 'swipe' | 'free' | 'queue';
const MODES: ViewMode[] = ['swipe', 'free', 'queue'];

interface ViewPrefs {
  mode: ViewMode;
  group: QueueGroup;
}

/** 怎麼看白板、怎麼分隊，都是每個人自己的看法，記在這台裝置上就好 */
export function useViewPrefs() {
  const [prefs, setPrefs] = useState<ViewPrefs | null>(null);
  useEffect(() => {
    AsyncStorage.multiGet(['boardView', 'queueGroup'])
      .then(([[, view], [, group]]) =>
        setPrefs({
          mode: MODES.find((m) => m === view) ?? 'swipe',
          group: GROUP_OPTIONS.find((o) => o.value === group)?.value ?? 'none',
        }),
      )
      .catch(() => setPrefs({ mode: 'swipe', group: 'none' }));
  }, []);
  const setMode = (mode: ViewMode) => {
    setPrefs((p) => p && { ...p, mode });
    AsyncStorage.setItem('boardView', mode).catch(() => {});
  };
  const setGroup = (group: QueueGroup) => {
    setPrefs((p) => p && { ...p, group });
    AsyncStorage.setItem('queueGroup', group).catch(() => {});
  };
  return { prefs, setMode, setGroup };
}
