import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** queue = 排隊（預設）：公告、記事各排一隊，上下捲、左右滑切換；free = 自由擺放 */
export type ViewMode = 'queue' | 'free';

/** 怎麼看白板是每個人自己的看法，記在這台裝置上就好（以前的「滑動」模式併進排隊了） */
export function useViewPrefs() {
  const [mode, setModeState] = useState<ViewMode | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('boardView')
      .then((view) => setModeState(view === 'free' ? 'free' : 'queue'))
      .catch(() => setModeState('queue'));
  }, []);
  const setMode = (next: ViewMode) => {
    setModeState(next);
    AsyncStorage.setItem('boardView', next).catch(() => {});
  };
  return { mode, setMode };
}
