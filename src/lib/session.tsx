import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { newAccountBoards, rememberBoard, withAccountBoards } from './account-boards';
import { errorMessage } from './errors';
import { currentAccount, ensureSignedIn, firebaseConfigured, signedInUid } from './firebase';
import { forgetLineLogin, lineIdentity, loginWithLine as openLineLogin } from './liff';
import { joinCodeFrom } from './line';
import { signInWithGoogle, signInWithLine, syncProfile, toProfile, type SignedIn } from './sign-in';
import type { Boards } from './types';

/** 怎麼登入的：LINE / Google 的名字、頭像跟著帳號，不用自己取暱稱 */
export type AccountKind = 'anonymous' | 'line' | 'google';

interface SessionState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  uid: string;
  nickname: string | null;
  /** LINE / Google 大頭貼（用帳號登入才有） */
  avatarUrl: string | null;
  account: AccountKind;
  /** 目前打開的公布欄 */
  groupId: string | null;
  /** 加入的所有公布欄（依加入順序；登入時會跟帳號上的清單合併，別台裝置加入的也在） */
  groupIds: string[];
  /** 送出加入申請、等房主同意的公布欄 */
  pendingIds: string[];
  /** 加入或建立後進入；已經在清單裡的就只是切換過去 */
  enterGroup: (groupId: string, nickname: string) => Promise<void>;
  /** 送出加入申請後記下來；房主同意後 usePendingJoins 會自動加入 */
  addPending: (groupId: string, nickname: string) => Promise<void>;
  /**
   * 加入申請有結果了（或自己收回）：同意的加進清單（還沒打開任何公布欄就直接打開），其他的拿掉。
   * 結果是從背景訂閱回來的（可能拿著舊的 session），所以只用函式型更新，同時好幾個也不會互相蓋掉
   */
  settlePending: (groupId: string, approved: boolean) => void;
  switchGroup: (groupId: string) => Promise<void>;
  /** 從清單拿掉目前的公布欄，換到下一個（都沒有了就回到第一次使用畫面） */
  leaveGroup: () => Promise<void>;
  /**
   * 用 LINE 登入：網頁版會跳到 LINE 登入頁（回來時打開公布欄就會登入，所以這裡回傳 false）；
   * 手機 App 版用系統瀏覽器登入完直接換成 LINE 帳號。使用者取消回傳 false
   */
  loginWithLine: () => Promise<boolean>;
  /** 用 Google 登入（要在按鈕的 onPress 裡直接呼叫，不然瀏覽器會擋彈出視窗）；使用者取消回傳 false */
  loginWithGoogle: () => Promise<boolean>;
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

const savePending = (ids: string[]) => AsyncStorage.setItem('pendingGroupIds', JSON.stringify(ids));

const saveOptional = (key: string, value: string | null) =>
  value ? AsyncStorage.setItem(key, value) : AsyncStorage.removeItem(key);

interface Saved extends Boards {
  nickname: string | null;
  avatarUrl: string | null;
  groupId: string | null;
}

type Started = Saved & { uid: string; account: AccountKind };

/** 上次打開的還在就打開它，不然打開第一個 */
const pickGroup = (last: string | null, groupIds: string[]) =>
  last && groupIds.includes(last) ? last : (groupIds[0] ?? null);

/**
 * 登入完成：跟帳號上的公布欄清單合併（別台裝置加入的也看得到），
 * 名字或頭像跟上次不一樣就更新到每個公布欄，再存起來
 */
async function settle(saved: Saved, next: SignedIn, account: AccountKind): Promise<Started> {
  const { uid, profile } = next;
  const { groupIds, pendingIds } = await withAccountBoards(uid, next);
  const groupId = pickGroup(saved.groupId, groupIds);
  if (profile.name !== saved.nickname || profile.avatarUrl !== saved.avatarUrl) {
    await syncProfile(uid, profile, groupIds);
  }
  await Promise.all([
    saveGroups(groupIds, groupId),
    savePending(pendingIds),
    AsyncStorage.setItem('nickname', profile.name),
    saveOptional('avatarUrl', profile.avatarUrl),
  ]);
  return { uid, account, nickname: profile.name, avatarUrl: profile.avatarUrl, groupId, groupIds, pendingIds };
}

const ACCOUNT_KINDS: AccountKind[] = ['anonymous', 'line', 'google'];
const asAccount = (v: string | null): AccountKind =>
  ACCOUNT_KINDS.find((k) => k === v) ?? 'anonymous';

/** 記下這次登入的是誰，下次打開先用它直接顯示公布欄 */
const saveIdentity = (uid: string, account: AccountKind) =>
  AsyncStorage.multiSet([
    ['uid', uid],
    ['account', account],
  ]);

/** 是點邀請連結打開的：要用確定的身分加入，得等登入完成，不能先用上次的身分 */
async function openedWithInvite() {
  const url = await Linking.getInitialURL().catch(() => null);
  return url ? joinCodeFrom(Linking.parse(url).queryParams ?? {}) !== null : false;
}

/**
 * 上次打開的人跟現在 Firebase 記得的是同一個，而且有公布欄可以打開：先直接顯示（像打開 LINE 自己的東西一樣不用等），
 * LINE 登入確認、帳號上的清單合併在背景進行，好了再更新
 */
async function quickStart(saved: Saved, uid: string | null, account: string | null): Promise<Started | null> {
  if (!uid || !saved.groupId || !saved.groupIds.includes(saved.groupId)) return null;
  const [current, invite] = await Promise.all([signedInUid(), openedWithInvite()]);
  if (current !== uid || invite) return null;
  return { ...saved, uid, account: asAccount(account) };
}

const boardsOf = ({ groupIds, pendingIds }: Boards): Boards => ({ groupIds, pendingIds });

/**
 * 打開時登入：
 * - 已經用 Google 登入：就是這個人（例如在電腦上點了 LINE 邀請連結，也不會被換成 LINE 帳號）
 * - 在 LINE 裡打開：用 LINE 登入；失敗（例如伺服器還沒設定好）就照舊匿名登入
 * - 其他：沿用上次的帳號，沒有就匿名登入
 */
async function startSession(saved: Saved): Promise<Started> {
  const before = await currentAccount();
  if (before?.google && !before.lineSub) {
    const next = { uid: before.uid, profile: toProfile(before.google, saved.nickname), ...boardsOf(saved) };
    return settle(saved, next, 'google');
  }
  // LIFF 打不開（例如本機開發、LIFF ID 設錯）就當作沒有 LINE
  const line = await lineIdentity().catch((e) => {
    console.warn('LIFF 初始化失敗', e);
    return null;
  });
  if (line) {
    try {
      return await settle(saved, await signInWithLine(line, saved.nickname, boardsOf(saved)), 'line');
    } catch (e) {
      console.warn('LINE 登入失敗，改用匿名登入', e);
      forgetLineLogin();
    }
  }
  // 之前用 LINE 登入過、這次 LINE 沒登入（例如在一般瀏覽器）：Firebase 還記得，照樣是同一個人
  const account = await currentAccount();
  const uid = account?.uid ?? (await ensureSignedIn());
  const boards = await withAccountBoards(uid, boardsOf(saved));
  return {
    ...saved,
    ...boards,
    groupId: pickGroup(saved.groupId, boards.groupIds),
    uid,
    account: account?.lineSub ? 'line' : 'anonymous',
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [error, setError] = useState<string>();
  const [uid, setUid] = useState('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountKind>('anonymous');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  // 清單有變就存起來（加入申請的結果是從背景訂閱來的，用函式型更新，沒辦法在當下就知道新清單）
  useEffect(() => {
    if (status !== 'ready') return;
    Promise.all([saveGroups(groupIds, groupId), savePending(pendingIds)]).catch((e) =>
      console.warn('儲存公布欄清單失敗', e),
    );
  }, [status, groupIds, groupId, pendingIds]);

  // 從背景回來時，把帳號上新加入的公布欄補進來（例如剛在 LINE 裡加入，再切回 iPhone 主畫面上的公布欄）
  useEffect(() => {
    if (status !== 'ready') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      newAccountBoards(uid, { groupIds, pendingIds })
        .then((added) => {
          if (!added.groupIds.length && !added.pendingIds.length) return;
          setGroupIds((ids) => [...ids, ...added.groupIds.filter((id) => !ids.includes(id))]);
          setPendingIds((p) => [
            ...p.filter((id) => !added.groupIds.includes(id)),
            ...added.pendingIds.filter((id) => !p.includes(id)),
          ]);
          setGroupId((current) => current ?? added.groupIds[0] ?? null);
        })
        .catch((e) => console.warn('讀取帳號上的公布欄失敗', e));
    });
    return () => sub.remove();
  }, [status, uid, groupIds, pendingIds]);

  // 記下這次登入的是誰（換帳號時也會更新），下次打開用 quickStart 直接顯示
  useEffect(() => {
    if (status !== 'ready' || !uid) return;
    saveIdentity(uid, account).catch((e) => console.warn('儲存登入狀態失敗', e));
  }, [status, uid, account]);

  const apply = (next: Started) => {
    setUid(next.uid);
    setNickname(next.nickname);
    setAvatarUrl(next.avatarUrl);
    setAccount(next.account);
    setGroupId(next.groupId);
    setGroupIds(next.groupIds);
    setPendingIds(next.pendingIds);
  };

  useEffect(() => {
    (async () => {
      try {
        if (!firebaseConfigured) throw new Error('尚未設定 Firebase（請參考 README 建立 .env）');
        const [[, nick], [, gid], [, ids], [, avatar], [, pending], [, lastUid], [, lastAccount]] =
          await AsyncStorage.multiGet(['nickname', 'groupId', 'groupIds', 'avatarUrl', 'pendingGroupIds', 'uid', 'account']);
        const groupIds = parseGroupIds(ids, gid);
        const pendingIds = parseGroupIds(pending, null).filter((id) => !groupIds.includes(id));
        const saved: Saved = { nickname: nick, avatarUrl: avatar, groupId: gid, groupIds, pendingIds };
        const quick = await quickStart(saved, lastUid, lastAccount).catch(() => null);
        if (!quick) {
          apply(await startSession(saved));
          setStatus('ready');
          return;
        }
        apply(quick);
        setStatus('ready');
        // 背景確認完：已經切到別的公布欄（例如點了小工具）就留在那裡，那個公布欄不在清單裡了才換
        startSession(saved).then(
          (next) => {
            apply(next);
            setGroupId((current) => (current && next.groupIds.includes(current) ? current : next.groupId));
          },
          (e) => console.warn('背景登入失敗，先用上次的資料', e),
        );
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
    account,
    groupId,
    groupIds,
    pendingIds,
    enterGroup: async (gid, nick) => {
      const ids = groupIds.includes(gid) ? groupIds : [...groupIds, gid];
      await Promise.all([saveGroups(ids, gid), AsyncStorage.setItem('nickname', nick)]);
      rememberBoard(uid, gid, 'joined');
      setNickname(nick);
      setGroupIds(ids);
      setPendingIds((p) => p.filter((id) => id !== gid));
      setGroupId(gid);
    },
    addPending: async (gid, nick) => {
      await AsyncStorage.setItem('nickname', nick);
      rememberBoard(uid, gid, 'pending');
      setNickname(nick);
      setPendingIds((p) => (p.includes(gid) ? p : [...p, gid]));
    },
    settlePending: (gid, approved) => {
      rememberBoard(uid, gid, approved ? 'joined' : null);
      setPendingIds((p) => p.filter((id) => id !== gid));
      if (!approved) return;
      setGroupIds((ids) => (ids.includes(gid) ? ids : [...ids, gid]));
      setGroupId((current) => current ?? gid);
    },
    switchGroup: async (gid) => {
      await AsyncStorage.setItem('groupId', gid);
      setGroupId(gid);
    },
    leaveGroup: async () => {
      const ids = groupIds.filter((id) => id !== groupId);
      const next = ids[0] ?? null;
      await saveGroups(ids, next);
      if (groupId) rememberBoard(uid, groupId, null);
      setGroupIds(ids);
      setGroupId(next);
    },
    loginWithLine: async () => {
      const line = await openLineLogin();
      if (!line) return false;
      const signed = await signInWithLine(line, nickname, { groupIds, pendingIds });
      apply(await settle({ nickname, avatarUrl, groupId, groupIds, pendingIds }, signed, 'line'));
      return true;
    },
    loginWithGoogle: async () => {
      const signed = await signInWithGoogle(nickname, { groupIds, pendingIds });
      if (!signed) return false;
      apply(await settle({ nickname, avatarUrl, groupId, groupIds, pendingIds }, signed, 'google'));
      return true;
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession 必須在 SessionProvider 裡使用');
  return ctx;
}
