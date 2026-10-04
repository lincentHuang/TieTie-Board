import { addAccountBoards, fetchAccountBoards, fetchBoardState, recordBoard } from './repo';
import type { BoardState, Boards } from './types';

/**
 * 我的公布欄清單跟著帳號走：存在這台裝置之外，也記在 Firestore 的 users/{uid}，
 * 換手機、換電腦用同一個 LINE / Google 帳號登入，之前加入的公布欄也都在。
 */

/** 沒網路時最多等這麼久就先用這台裝置記得的，不要卡在載入畫面 */
const FETCH_TIMEOUT_MS = 4000;

const within = <T>(ms: number, job: Promise<T>) =>
  Promise.race([job, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('讀取逾時')), ms))]);

const unique = (ids: string[]) => [...new Set(ids)];

/** 只有這台裝置記得的公布欄：確認自己還在不在；確認不了（例如網路斷了）就照這台裝置記得的 */
async function check(gid: string, uid: string, local: Boards) {
  try {
    return { gid, state: await fetchBoardState(gid, uid), sure: true };
  } catch (e) {
    console.warn('確認公布欄狀態失敗', gid, e);
    const state: BoardState = local.groupIds.includes(gid) ? 'joined' : 'pending';
    return { gid, state, sure: false };
  }
}

/**
 * 登入後跟帳號上的清單合併：
 * - 帳號上有記的：照帳號上的狀態（別台裝置加入的也算；等待中的申請有結果後 usePendingJoins 會處理）
 * - 只有這台裝置記得的（改版前加入、還沒同步上去，或已經在別台裝置離開了）：確認自己還在不在，還在的補記到帳號上
 * 讀不到帳號上的清單（沒網路、權限規則還沒部署）就照這台裝置記得的
 */
export async function withAccountBoards(uid: string, local: Boards): Promise<Boards> {
  let remote: Boards;
  try {
    remote = await within(FETCH_TIMEOUT_MS, fetchAccountBoards(uid));
  } catch (e) {
    console.warn('讀取帳號上的公布欄失敗，先用這台裝置記得的', e);
    return local;
  }
  const states = new Map<string, BoardState>();
  for (const gid of remote.pendingIds) states.set(gid, 'pending');
  for (const gid of remote.groupIds) states.set(gid, 'joined');

  const localOnly = unique([...local.groupIds, ...local.pendingIds]).filter((gid) => !states.has(gid));
  const checked = await Promise.all(localOnly.map((gid) => check(gid, uid, local)));
  for (const { gid, state } of checked) states.set(gid, state);

  const confirmed = checked.filter((c) => c.sure);
  const missing = {
    groupIds: confirmed.filter((c) => c.state === 'joined').map((c) => c.gid),
    pendingIds: confirmed.filter((c) => c.state === 'pending').map((c) => c.gid),
  };
  if (missing.groupIds.length || missing.pendingIds.length) {
    // 在背景補記：沒網路時 Firestore 會等連上再送，不用卡著登入
    addAccountBoards(uid, missing).catch((e) => console.warn('同步公布欄清單失敗', e));
  }

  // 這台裝置原本的順序在前，別台裝置加入的接在後面
  const all = unique([...local.groupIds, ...local.pendingIds, ...remote.groupIds, ...remote.pendingIds]);
  return {
    groupIds: all.filter((gid) => states.get(gid) === 'joined'),
    pendingIds: all.filter((gid) => states.get(gid) === 'pending'),
  };
}

/**
 * 帳號上有、這台裝置還沒有的公布欄（從背景回來時補上，例如剛在 LINE 裡加入，再從 iPhone 主畫面打開）。
 * 只補不刪：離開、被拒絕這些由登入時的合併和 usePendingJoins 處理
 */
export async function newAccountBoards(uid: string, local: Boards): Promise<Boards> {
  const remote = await fetchAccountBoards(uid);
  const known = (gid: string) => local.groupIds.includes(gid);
  return {
    groupIds: remote.groupIds.filter((gid) => !known(gid)),
    pendingIds: remote.pendingIds.filter((gid) => !known(gid) && !local.pendingIds.includes(gid)),
  };
}

/** 加入、送出申請、離開、申請有結果時記到帳號上（在背景進行：沒網路時 Firestore 會等連上再送） */
export const rememberBoard = (uid: string, gid: string, state: BoardState) => {
  recordBoard(uid, gid, state).catch((e) => console.warn('同步公布欄清單失敗', gid, e));
};
