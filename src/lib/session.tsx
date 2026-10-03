import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { errorMessage } from './errors';
import { ensureSignedIn, firebaseConfigured } from './firebase';

interface SessionState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  uid: string;
  nickname: string | null;
  /** 目前打開的公布欄 */
  groupId: string | null;
  /** 這台裝置加入的所有公布欄（依加入順序） */
  groupIds: string[];
  /** 加入或建立後進入；已經在清單裡的就只是切換過去 */
  enterGroup: (groupId: string, nickname: string) => Promise<void>;
  switchGroup: (groupId: string) => Promise<void>;
  /** 從清單拿掉目前的公布欄，換到下一個（都沒有了就回到第一次使用畫面） */
  leaveGroup: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/** 舊版只記一個 groupId；清單讀不到或壞掉時，至少保留目前這個 */
function parseGroupIds(raw: string | null, current: string | null) {
  let ids: string[] = [];
  try {
    const data: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) ids = data.filter((x): x is string => typeof x === 'string');
  } catch {
    // 格式壞掉 → 當作沒有清單
  }
  return current && !ids.includes(current) ? [...ids, current] : ids;
}

/** 不經過畫面讀這台裝置加入的所有公布欄（背景更新小工具時用） */
export async function loadSavedGroupIds() {
  const [[, gid], [, ids]] = await AsyncStorage.multiGet(['groupId', 'groupIds']);
  return parseGroupIds(ids, gid);
}

const saveGroups = (ids: string[], current: string | null) =>
  Promise.all([
    AsyncStorage.setItem('groupIds', JSON.stringify(ids)),
    current ? AsyncStorage.setItem('groupId', current) : AsyncStorage.removeItem('groupId'),
  ]);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [error, setError] = useState<string>();
  const [uid, setUid] = useState('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        if (!firebaseConfigured) throw new Error('尚未設定 Firebase（請參考 README 建立 .env）');
        const [id, [[, nick], [, gid], [, ids]]] = await Promise.all([
          ensureSignedIn(),
          AsyncStorage.multiGet(['nickname', 'groupId', 'groupIds']),
        ]);
        setUid(id);
        setNickname(nick);
        setGroupId(gid);
        setGroupIds(parseGroupIds(ids, gid));
        setStatus('ready');
      } catch (e) {
        setError(errorMessage(e));
        setStatus('error');
      }
    })();
  }, []);

  const value: SessionState = {
    status,
    error,
    uid,
    nickname,
    groupId,
    groupIds,
    enterGroup: async (gid, nick) => {
      const ids = groupIds.includes(gid) ? groupIds : [...groupIds, gid];
      await Promise.all([saveGroups(ids, gid), AsyncStorage.setItem('nickname', nick)]);
      setNickname(nick);
      setGroupIds(ids);
      setGroupId(gid);
    },
    switchGroup: async (gid) => {
      await AsyncStorage.setItem('groupId', gid);
      setGroupId(gid);
    },
    leaveGroup: async () => {
      const ids = groupIds.filter((id) => id !== groupId);
      const next = ids[0] ?? null;
      await saveGroups(ids, next);
      setGroupIds(ids);
      setGroupId(next);
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession 必須在 SessionProvider 裡使用');
  return ctx;
}
