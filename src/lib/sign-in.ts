import { currentAccount, exchangeLineToken, googleLogin, signInWithToken, type RawProfile } from './firebase';
import { joinBoard } from './join';
import type { LineIdentity } from './line';
import { handOverIfOwner, leaveGroup, removeJoinRequest, updateProfile } from './repo';
import { isAvatarUrl, type Boards, type MemberProfile } from './types';

/**
 * 登入方式：LINE 為主（家庭群組點進來最順），Google 當備案（在電腦上看、沒有 LINE 的人），
 * 都沒有就匿名登入、自己取暱稱（手機 App 版目前只有這個）
 */

/** LINE / Google 給的名字和頭像整理成成員資料（名字最多 30 字，跟通報的署名長度一樣） */
export const toProfile = (raw: RawProfile | null, fallbackName: string | null): MemberProfile => ({
  name: (raw?.name?.trim() || fallbackName || '家人').slice(0, 30),
  avatarUrl: raw?.photoURL && isAvatarUrl(raw.photoURL) ? raw.photoURL : null,
});

/** 登入後的身分，加上這台裝置的公布欄（換成別人的帳號時會清空，之後再跟帳號上的清單合併） */
export interface SignedIn extends Boards {
  uid: string;
  profile: MemberProfile;
}

const warnEach = (label: string, jobs: Promise<unknown>[]) =>
  Promise.all(jobs.map((job) => job.catch((e) => console.warn(label, e))));

/** 用新身分重新加入：可能直接加入（還是成員、LINE 群組成員），也可能要重新等房主同意 */
async function rejoin(boards: Boards, uid: string, profile: MemberProfile): Promise<Boards> {
  const results = await Promise.all(
    [...boards.groupIds, ...boards.pendingIds].map(async (gid) => {
      try {
        return { gid, result: await joinBoard(gid, uid, profile) };
      } catch (e) {
        // 先照原本的樣子留著，下次打開再說
        console.warn('用新身分重新加入失敗', gid, e);
        return { gid, result: boards.groupIds.includes(gid) ? 'joined' : 'pending' };
      }
    }),
  );
  const pick = (want: string) => results.filter((r) => r.result === want).map((r) => r.gid);
  return { groupIds: pick('joined'), pendingIds: pick('pending') };
}

/**
 * 換成另一個已經存在的帳號（這個 LINE / Google 帳號在別台裝置用過）：
 * - 原本是匿名成員：先用舊身分離開、收回申請（換過去之後就沒辦法了），再用新身分重新加入，不留下重複的人。
 *   事先知道新帳號（LINE）時，自己當房主的公布欄先把房主交給新帳號，不然回來要等「自己」同意
 * - 原本是別的 LINE / Google 帳號：那些公布欄是別人的，這台裝置重新開始
 */
async function switchTo(
  from: { uid: string; anonymous: boolean },
  boards: Boards,
  fallbackName: string | null,
  switchAccount: () => Promise<{ uid: string; raw: RawProfile | null }>,
  next?: { uid: string; profile: MemberProfile },
): Promise<SignedIn> {
  if (from.anonymous) {
    if (next) {
      const { uid, profile } = next;
      await warnEach('交接房主失敗', boards.groupIds.map((gid) => handOverIfOwner(gid, from.uid, uid, profile)));
    }
    await Promise.all([
      warnEach('移除舊的匿名成員失敗', boards.groupIds.map((gid) => leaveGroup(gid, from.uid))),
      warnEach('收回舊的加入申請失敗', boards.pendingIds.map((gid) => removeJoinRequest(gid, from.uid))),
    ]);
  }
  const { uid, raw } = await switchAccount();
  const profile = toProfile(raw, fallbackName);
  if (!from.anonymous) return { uid, profile, groupIds: [], pendingIds: [] };
  return { uid, profile, ...(await rejoin(boards, uid, profile)) };
}

/**
 * 用 LINE 身分登入（在 LINE 裡打開時自動進行）。
 * 已經是這個 LINE 帳號就不用再問伺服器；這台裝置原本是匿名成員時，伺服器會沿用同一個 uid。
 */
export async function signInWithLine(line: LineIdentity, fallbackName: string | null, boards: Boards): Promise<SignedIn> {
  const raw = { name: line.name, photoURL: line.avatarUrl };
  const profile = toProfile(raw, fallbackName);
  const before = await currentAccount();
  if (before?.lineSub === line.sub) return { uid: before.uid, profile, ...boards };

  const { token, uid } = await exchangeLineToken(line.idToken);
  const signIn = () => signInWithToken(token).then((id) => ({ uid: id, raw }));
  if (before && before.uid !== uid) return switchTo(before, boards, fallbackName, signIn, { uid, profile });
  await signIn();
  return { uid, profile, ...boards };
}

/**
 * 用 Google 登入（按鈕按下去時；要在 onPress 裡直接呼叫，中間不能先 await）。使用者取消回傳 null。
 * 匿名帳號直接綁上 Google，uid 不變，公布欄、便利貼都留著。
 */
export async function signInWithGoogle(fallbackName: string | null, boards: Boards): Promise<SignedIn | null> {
  const login = await googleLogin();
  if (!login) return null;
  if (!login.switchAccount) return { uid: login.uid, profile: toProfile(login.google, fallbackName), ...boards };
  const { switchAccount } = login;
  return switchTo(login, boards, fallbackName, () => switchAccount().then((a) => ({ uid: a.uid, raw: a.google })));
}

/** LINE / Google 的名字或大頭貼換了：每個加入的公布欄都更新 */
export const syncProfile = (uid: string, profile: MemberProfile, groupIds: string[]) =>
  warnEach('更新名字頭像失敗', groupIds.map((gid) => updateProfile(gid, uid, profile)));
