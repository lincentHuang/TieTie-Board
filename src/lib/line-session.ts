import { currentAccount, exchangeLineToken, signInWithToken } from './firebase';
import { isLineAvatarUrl, type LineIdentity } from './line';
import { joinGroup, leaveGroup, updateProfile } from './repo';
import type { MemberProfile } from './types';

/** LINE 給的名字、頭像整理成成員資料（名字最多 30 字，跟通報的署名長度一樣） */
export const lineProfile = (line: LineIdentity, fallbackName: string | null): MemberProfile => ({
  name: (line.name ?? fallbackName ?? 'LINE 使用者').slice(0, 30),
  avatarUrl: line.avatarUrl && isLineAvatarUrl(line.avatarUrl) ? line.avatarUrl : null,
});

const warnEach = (label: string, jobs: Promise<unknown>[]) =>
  Promise.all(jobs.map((job) => job.catch((e) => console.warn(label, e))));

/**
 * 用 LINE 身分登入，回傳 uid 與這台裝置的公布欄清單。
 * - 已經是這個 LINE 帳號：不用再問伺服器
 * - 這台裝置原本是匿名成員：伺服器沿用同一個 uid，公布欄、便利貼、確認紀錄都留著
 * - 這個 LINE 帳號在別台裝置用過：換成那個 uid，原本的匿名成員搬過去（不留下一個重複的人）
 * - 換了另一個 LINE 帳號：原本的公布欄是別人的，這台裝置重新開始
 */
export async function signInWithLine(line: LineIdentity, profile: MemberProfile, groupIds: string[]) {
  const before = await currentAccount();
  if (before?.lineSub === line.sub) return { uid: before.uid, groupIds };

  const { token, uid } = await exchangeLineToken(line.idToken);
  const moving = before !== null && before.uid !== uid && before.anonymous;
  // 先用匿名身分離開（之後就沒辦法再用那個身分了）
  if (moving) await warnEach('移除舊的匿名成員失敗', groupIds.map((gid) => leaveGroup(gid, before.uid)));
  await signInWithToken(token);

  if (before === null || before.uid === uid) return { uid, groupIds };
  if (!moving) return { uid, groupIds: [] };
  await warnEach('用 LINE 身分重新加入失敗', groupIds.map((gid) => joinGroup(gid, uid, profile)));
  return { uid, groupIds };
}

/** LINE 的名字或大頭貼換了：每個加入的公布欄都更新 */
export const syncProfile = (uid: string, profile: MemberProfile, groupIds: string[]) =>
  warnEach('更新名字頭像失敗', groupIds.map((gid) => updateProfile(gid, uid, profile)));
