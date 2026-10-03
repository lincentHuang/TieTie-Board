import { currentAccount, exchangeLineToken, googleLogin, signInWithToken, type RawProfile } from './firebase';
import type { LineIdentity } from './line';
import { joinGroup, leaveGroup, updateProfile } from './repo';
import { isAvatarUrl, type MemberProfile } from './types';

/**
 * 登入方式：LINE 為主（家庭群組點進來最順），Google 當備案（在電腦上看、沒有 LINE 的人），
 * 都沒有就匿名登入、自己取暱稱（手機 App 版目前只有這個）
 */

/** LINE / Google 給的名字和頭像整理成成員資料（名字最多 30 字，跟通報的署名長度一樣） */
export const toProfile = (raw: RawProfile | null, fallbackName: string | null): MemberProfile => ({
  name: (raw?.name?.trim() || fallbackName || '家人').slice(0, 30),
  avatarUrl: raw?.photoURL && isAvatarUrl(raw.photoURL) ? raw.photoURL : null,
});

export interface SignedIn {
  uid: string;
  profile: MemberProfile;
  /** 這台裝置的公布欄（換成別人的帳號時會清空） */
  groupIds: string[];
}

const warnEach = (label: string, jobs: Promise<unknown>[]) =>
  Promise.all(jobs.map((job) => job.catch((e) => console.warn(label, e))));

/**
 * 換成另一個已經存在的帳號（這個 LINE / Google 帳號在別台裝置用過）：
 * - 原本是匿名成員：先用舊身分離開（換過去之後就沒辦法了），再用新身分重新加入，不留下重複的人
 * - 原本是別的 LINE / Google 帳號：那些公布欄是別人的，這台裝置重新開始
 */
async function switchTo(
  from: { uid: string; anonymous: boolean },
  groupIds: string[],
  fallbackName: string | null,
  switchAccount: () => Promise<{ uid: string; raw: RawProfile | null }>,
): Promise<SignedIn> {
  if (from.anonymous) await warnEach('移除舊的匿名成員失敗', groupIds.map((gid) => leaveGroup(gid, from.uid)));
  const { uid, raw } = await switchAccount();
  const profile = toProfile(raw, fallbackName);
  if (!from.anonymous) return { uid, profile, groupIds: [] };
  await warnEach('用新身分重新加入失敗', groupIds.map((gid) => joinGroup(gid, uid, profile)));
  return { uid, profile, groupIds };
}

/**
 * 用 LINE 身分登入（在 LINE 裡打開時自動進行）。
 * 已經是這個 LINE 帳號就不用再問伺服器；這台裝置原本是匿名成員時，伺服器會沿用同一個 uid。
 */
export async function signInWithLine(line: LineIdentity, fallbackName: string | null, groupIds: string[]) {
  const raw = { name: line.name, photoURL: line.avatarUrl };
  const before = await currentAccount();
  if (before?.lineSub === line.sub) return { uid: before.uid, profile: toProfile(raw, fallbackName), groupIds };

  const { token, uid } = await exchangeLineToken(line.idToken);
  const signIn = () => signInWithToken(token).then((id) => ({ uid: id, raw }));
  if (before && before.uid !== uid) return switchTo(before, groupIds, fallbackName, signIn);
  await signIn();
  return { uid, profile: toProfile(raw, fallbackName), groupIds };
}

/**
 * 用 Google 登入（按鈕按下去時；要在 onPress 裡直接呼叫，中間不能先 await）。使用者取消回傳 null。
 * 匿名帳號直接綁上 Google，uid 不變，公布欄、便利貼都留著。
 */
export async function signInWithGoogle(fallbackName: string | null, groupIds: string[]): Promise<SignedIn | null> {
  const login = await googleLogin();
  if (!login) return null;
  if (!login.switchAccount) return { uid: login.uid, profile: toProfile(login.google, fallbackName), groupIds };
  const { switchAccount } = login;
  return switchTo(login, groupIds, fallbackName, () => switchAccount().then((a) => ({ uid: a.uid, raw: a.google })));
}

/** LINE / Google 的名字或大頭貼換了：每個加入的公布欄都更新 */
export const syncProfile = (uid: string, profile: MemberProfile, groupIds: string[]) =>
  warnEach('更新名字頭像失敗', groupIds.map((gid) => updateProfile(gid, uid, profile)));
