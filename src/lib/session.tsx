import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { ensureSignedIn, firebaseConfigured } from './firebase';

interface SessionState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  uid: string;
  nickname: string | null;
  groupId: string | null;
  enterGroup: (groupId: string, nickname: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [error, setError] = useState<string>();
  const [uid, setUid] = useState('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!firebaseConfigured) throw new Error('尚未設定 Firebase（請參考 README 建立 .env）');
        const [id, nick, gid] = await Promise.all([
          ensureSignedIn(),
          AsyncStorage.getItem('nickname'),
          AsyncStorage.getItem('groupId'),
        ]);
        setUid(id);
        setNickname(nick);
        setGroupId(gid);
        setStatus('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
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
    enterGroup: async (gid, nick) => {
      await AsyncStorage.multiSet([
        ['groupId', gid],
        ['nickname', nick],
      ]);
      setNickname(nick);
      setGroupId(gid);
    },
    leaveGroup: async () => {
      await AsyncStorage.removeItem('groupId');
      setGroupId(null);
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession 必須在 SessionProvider 裡使用');
  return ctx;
}
