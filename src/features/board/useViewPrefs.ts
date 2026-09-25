import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { GROUP_OPTIONS, type QueueGroup } from './queue-filter';

interface ViewPrefs {
  queued: boolean;
  group: QueueGroup;
}

/** 自由擺放 / 排隊、怎麼分隊，都是每個人自己的看法，記在這台裝置上就好 */
export function useViewPrefs() {
  const [prefs, setPrefs] = useState<ViewPrefs | null>(null);
  useEffect(() => {
    AsyncStorage.multiGet(['boardView', 'queueGroup'])
      .then(([[, view], [, group]]) =>
        setPrefs({
          queued: view === 'queue',
          group: GROUP_OPTIONS.find((o) => o.value === group)?.value ?? 'none',
        }),
      )
      .catch(() => setPrefs({ queued: false, group: 'none' }));
  }, []);
  const setQueued = (queued: boolean) => {
    setPrefs((p) => p && { ...p, queued });
    AsyncStorage.setItem('boardView', queued ? 'queue' : 'free').catch(() => {});
  };
  const setGroup = (group: QueueGroup) => {
    setPrefs((p) => p && { ...p, group });
    AsyncStorage.setItem('queueGroup', group).catch(() => {});
  };
  return { prefs, setQueued, setGroup };
}
