import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { errorMessage } from './errors';
import { currentAccount, ensureSignedIn, firebaseConfigured } from './firebase';
import { forgetLineLogin, lineIdentity } from './liff';
import type { LineIdentity } from './line';
import { lineProfile, signInWithLine, syncProfile } from './line-session';

interface SessionState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  uid: string;
  nickname: string | null;
  /** LINE 大頭貼（用 LINE 登入才有） */
  avatarUrl: string | null;
  /** 用 LINE 帳號登入：名字、頭像跟著 LINE，不用自己取暱稱 */
  lineLinked: boolean;
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

const saveOptional = (key: string, value: string | null) =>
  value ? AsyncStorage.setItem(key, value) : AsyncStorage.removeItem(key);

interface Saved {
  nickname: string | null;
  avatarUrl: string | null;
  groupId: string | null;
  groupIds: string[];
}

/** 有 LINE 身分就用 LINE 登入，名字頭像跟著 LINE；失敗（例如伺服器還沒設定好）就照舊匿名登入 */
async function startSession(line: LineIdentity | null, saved: Saved): Promise<Saved & { uid: string; lineLinked: boolean }> {
  if (line) {
    try {
      const profile = lineProfile(line, saved.nickname);
      const { uid, groupIds } = await signInWithLine(line, profile, saved.groupIds);
      const groupId = saved.groupId && groupIds.includes(saved.groupId) ? saved.groupId : (groupIds[0] ?? null);
      if (profile.name !== saved.nickname || profile.avatarUrl !== saved.avatarUrl) {
        await syncProfile(uid, profile, groupIds);
      }
      await Promise.all([
        saveGroups(groupIds, groupId),
        AsyncStorage.setItem('nickname', profile.name),
        saveOptional('avatarUrl', profile.avatarUrl),
      ]);
      return { uid, lineLinked: true, nickname: profile.name, avatarUrl: profile.avatarUrl, groupId, groupIds };
    } catch (e) {
      console.warn('LINE 登入失敗，改用匿名登入', e);
      forgetLineLogin();
    }
  }
  // 之前用 LINE 登入過、這次 LINE 沒登入（例如在一般瀏覽器）：Firebase 還記得，照樣是同一個人
  const account = await currentAccount();
  if (account) return { ...saved, uid: account.uid, lineLinked: account.lineSub !== null };
  return { ...saved, uid: await ensureSignedIn(), lineLinked: false };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [error, setError] = useState<string>();
  const [uid, setUid] = useState('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [lineLinked, setLineLinked] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        if (!firebaseConfigured) throw new Error('尚未設定 Firebase（請參考 README 建立 .env）');
        const [line, [[, nick], [, gid], [, ids], [, avatar]]] = await Promise.all([
          // LIFF 打不開（例如本機開發、LIFF ID 設錯）就當作沒有 LINE
          lineIdentity().catch((e) => {
            console.warn('LIFF 初始化失敗', e);
            return null;
          }),
          AsyncStorage.multiGet(['nickname', 'groupId', 'groupIds', 'avatarUrl']),
        ]);
        const next = await startSession(line, {
          nickname: nick,
          avatarUrl: avatar,
          groupId: gid,
          groupIds: parseGroupIds(ids, gid),
        });
        setUid(next.uid);
        setNickname(next.nickname);
        setAvatarUrl(next.avatarUrl);
        setLineLinked(next.lineLinked);
        setGroupId(next.groupId);
        setGroupIds(next.groupIds);
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
    avatarUrl,
    lineLinked,
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
