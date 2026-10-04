import { currentAccount, joinWithLineGroup } from './firebase';
import { canLoginWithLine } from './liff';
import { fetchGroup, isMemberOf, requestToJoin, saveMember } from './repo';
import type { MemberProfile } from './types';

/** joined = 已經加入；pending = 送出申請了，等房主同意；missing = 找不到這個邀請碼 */
export type JoinResult = 'joined' | 'pending' | 'missing';

/** 用 LINE 登入的人：問伺服器是不是公布欄綁定的 LINE 群組成員（伺服器出狀況就當作不是，改走申請） */
async function joinedViaLineGroup(gid: string, profile: MemberProfile) {
  if (!canLoginWithLine) return false;
  const account = await currentAccount();
  if (!account?.lineSub) return false;
  try {
    return await joinWithLineGroup(gid, profile);
  } catch (e) {
    console.warn('確認 LINE 群組成員失敗，改成送出申請', e);
    return false;
  }
}

/**
 * 用邀請碼加入公布欄：
 * - 已經是成員、或自己就是房主 → 更新名字和頭像
 * - 用 LINE 登入、而且在房主綁定的 LINE 群組裡（從群組點邀請連結進來的家人）→ 伺服器確認後直接加入
 * - 其他（自己輸入邀請碼、從別的地方拿到連結、不在群組裡）→ 送出申請，等房主同意
 */
export async function joinBoard(gid: string, uid: string, profile: MemberProfile): Promise<JoinResult> {
  const group = await fetchGroup(gid);
  if (!group) return 'missing';
  if (group.ownerId === uid || (await isMemberOf(gid, uid))) {
    await saveMember(gid, uid, profile);
    return 'joined';
  }
  if (await joinedViaLineGroup(gid, profile)) return 'joined';
  await requestToJoin(gid, uid, profile);
  return 'pending';
}
