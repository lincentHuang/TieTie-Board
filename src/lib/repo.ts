import { getRandomBytes } from 'expo-crypto';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  addDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  ALERT_LEVELS,
  ITEM_TYPES,
  PRIORITIES,
  STATUSES,
  type BoardDigest,
  type BoardItem,
  type BoardState,
  type Boards,
  type GroupInfo,
  type JoinRequest,
  type JoinStatus,
  type Member,
  type MemberProfile,
  type QuickAlert,
} from './types';

/**
 * Firestore 結構：
 *   groups/{邀請碼}                 name, ownerId, createdAt
 *   groups/{邀請碼}/members/{uid}   name, avatarUrl?, joinedAt, pushToken?, pushOS?
 *   groups/{邀請碼}/joinRequests/{uid}  name, avatarUrl?, createdAt（等房主同意的加入申請）
 *   groups/{邀請碼}/lineGroups/{LINE 群組 ID}  boundAt, boundBy（綁定的 LINE 群組，只有伺服器能讀寫）
 *   groups/{邀請碼}/items/{id}      BoardItem（白板上的便利貼 / 圖片 / 貼圖 / 公告）
 *   groups/{邀請碼}/alerts/{id}     QuickAlert（快速通報）
 *   lineAccounts/{LINE 使用者 ID}   uid（LINE 帳號對應的成員身分，只有伺服器 /api/line-login 能讀寫）
 *   users/{uid}                     groupIds, pendingIds, updatedAt（帳號上記的公布欄清單，換裝置登入同一個帳號也找得回來；
 *                                   只是索引，讀不讀得到公布欄還是看 members）
 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易看錯的 0/O/1/I

const groupRef = (gid: string) => doc(db, 'groups', gid);
const itemsRef = (gid: string) => collection(db, 'groups', gid, 'items');
const membersRef = (gid: string) => collection(db, 'groups', gid, 'members');
const alertsRef = (gid: string) => collection(db, 'groups', gid, 'alerts');
const joinRequestsRef = (gid: string) => collection(db, 'groups', gid, 'joinRequests');
const accountRef = (uid: string) => doc(db, 'users', uid);

export const normalizeCode = (input: string) => input.trim().toUpperCase();

function randomCode() {
  const bytes = getRandomBytes(6);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export async function createGroup(name: string, uid: string, profile: MemberProfile) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const created = await runTransaction(db, async (tx) => {
      if ((await tx.get(groupRef(code))).exists()) return false;
      tx.set(groupRef(code), { name, ownerId: uid, createdAt: serverTimestamp() });
      return true;
    });
    if (created) {
      await saveMember(code, uid, profile);
      return code;
    }
  }
  throw new Error('無法產生邀請碼，請再試一次');
}

const profileData = (p: MemberProfile) => ({ name: p.name, avatarUrl: p.avatarUrl ?? deleteField() });

/**
 * 寫入成員資料：已經是成員就只更新名字和頭像。
 * 還不是成員時只有房主能寫（建立群組時加自己）；其他人要走 joinBoard（src/lib/join.ts）
 */
export const saveMember = (gid: string, uid: string, profile: MemberProfile) =>
  setDoc(doc(membersRef(gid), uid), { ...profileData(profile), joinedAt: serverTimestamp() }, { merge: true });

/** 自己是不是已經是這個公布欄的成員（自己的成員資料隨時讀得到） */
export const isMemberOf = async (gid: string, uid: string) => (await getDoc(doc(membersRef(gid), uid))).exists();

/**
 * 換帳號前（還是房主的時候）先把新帳號加成成員、房主交給它；不是房主就什麼都不做。
 * 不然換過去之後，新帳號要等房主同意才能回來，可是房主就是自己。
 */
export async function handOverIfOwner(gid: string, from: string, to: string, profile: MemberProfile) {
  if ((await getDoc(groupRef(gid))).data()?.ownerId !== from) return;
  const batch = writeBatch(db);
  batch.set(doc(membersRef(gid), to), { ...profileData(profile), joinedAt: serverTimestamp() }, { merge: true });
  batch.update(groupRef(gid), { ownerId: to });
  await batch.commit();
}

/** LINE 的名字或大頭貼換了：更新自己在這個公布欄上的樣子 */
export const updateProfile = (gid: string, uid: string, profile: MemberProfile) =>
  updateDoc(doc(membersRef(gid), uid), profileData(profile));

export const leaveGroup = (gid: string, uid: string) => deleteDoc(doc(membersRef(gid), uid));

/* 讀回來的資料可能是舊版本或別台裝置寫的，每個欄位都先檢查型別，不對就用預設值 */
const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const optStr = (v: unknown) => (typeof v === 'string' ? v : undefined);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => list.find((x) => x === v) ?? fallback;
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const toGroup = (d: Record<string, unknown> | undefined): GroupInfo => ({
  name: str(d?.name, '公布欄'),
  ownerId: str(d?.ownerId, ''),
});

/** 邀請碼不存在時回傳 null */
export async function fetchGroup(gid: string) {
  const snap = await getDoc(groupRef(gid));
  return snap.exists() ? toGroup(snap.data()) : null;
}

export const watchGroup = (gid: string, cb: (group: GroupInfo) => void) =>
  onSnapshot(groupRef(gid), (s) => cb(toGroup(s.data())));

export const watchGroupName = (gid: string, cb: (name: string) => void) => watchGroup(gid, (g) => cb(g.name));

const toMember = (uid: string, d: Record<string, unknown>): Member => ({
  uid,
  name: str(d.name, '（未命名）'),
  avatarUrl: optStr(d.avatarUrl) ?? null,
});

export const watchMembers = (gid: string, cb: (members: Member[]) => void) =>
  onSnapshot(membersRef(gid), (s) => cb(s.docs.map((d) => toMember(d.id, d.data()))));

/** 自己在這個公布欄的狀態（自己的成員資料、加入申請隨時讀得到） */
export async function fetchBoardState(gid: string, uid: string): Promise<BoardState> {
  const [member, request] = await Promise.all([
    getDoc(doc(membersRef(gid), uid)),
    getDoc(doc(joinRequestsRef(gid), uid)),
  ]);
  if (member.exists()) return 'joined';
  return request.exists() ? 'pending' : null;
}

/* ---------- 帳號上的公布欄清單（換手機、換電腦登入同一個帳號，也看得到之前加入的） ---------- */

/** 還沒有紀錄（新帳號、還沒同步過）就是空的 */
export async function fetchAccountBoards(uid: string): Promise<Boards> {
  const d = (await getDoc(accountRef(uid))).data();
  return { groupIds: strList(d?.groupIds), pendingIds: strList(d?.pendingIds) };
}

/** 補上帳號還沒記的公布欄（用 arrayUnion，別台裝置同時加的不會被蓋掉） */
export const addAccountBoards = (uid: string, boards: Boards) =>
  setDoc(
    accountRef(uid),
    { groupIds: arrayUnion(...boards.groupIds), pendingIds: arrayUnion(...boards.pendingIds), updatedAt: serverTimestamp() },
    { merge: true },
  );

/** 加入、送出申請、離開、申請有結果時記到帳號上 */
export const recordBoard = (uid: string, gid: string, state: BoardState) =>
  setDoc(
    accountRef(uid),
    {
      groupIds: state === 'joined' ? arrayUnion(gid) : arrayRemove(gid),
      pendingIds: state === 'pending' ? arrayUnion(gid) : arrayRemove(gid),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

/* ---------- 加入申請（不是從綁定的 LINE 群組點進來的人，要等房主同意） ---------- */

/** 送出（或更新）加入申請；名字最多 30 字（規則也會擋） */
export const requestToJoin = (gid: string, uid: string, profile: MemberProfile) =>
  setDoc(doc(joinRequestsRef(gid), uid), {
    name: profile.name.slice(0, 30),
    ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : null),
    createdAt: serverTimestamp(),
  });

/** 申請的人收回、或房主拒絕 */
export const removeJoinRequest = (gid: string, uid: string) => deleteDoc(doc(joinRequestsRef(gid), uid));

/** 房主同意：加成成員、刪掉申請（同一次寫入，申請的人不會看到「申請不見了、也還不是成員」） */
export async function approveJoinRequest(gid: string, req: JoinRequest) {
  const batch = writeBatch(db);
  batch.set(doc(membersRef(gid), req.uid), { ...profileData(req), joinedAt: serverTimestamp() }, { merge: true });
  batch.delete(doc(joinRequestsRef(gid), req.uid));
  await batch.commit();
}

/** 房主看等待中的申請，先送出的在前（只有房主讀得到，別人訂閱會被規則擋下） */
export const watchJoinRequests = (gid: string, cb: (requests: JoinRequest[]) => void) =>
  onSnapshot(
    joinRequestsRef(gid),
    (s) => {
      const list = s.docs.map((d): JoinRequest => ({ ...toMember(d.id, d.data()), createdAt: millis(d.data().createdAt) }));
      cb(list.sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity)));
    },
    (e) => console.warn('讀取加入申請失敗', gid, e),
  );

/**
 * 我送出的申請現在怎樣了。申請還在 = 等待中；不見了就去伺服器看自己是不是已經是成員。
 * 本機快取說「沒有」不算數（可能只是還沒跟伺服器同步），自己剛收回的也不算（那不是房主拒絕）
 */
export const watchJoinStatus = (gid: string, uid: string, cb: (status: JoinStatus) => void) =>
  onSnapshot(
    doc(joinRequestsRef(gid), uid),
    (s) => {
      if (s.exists()) return cb('pending');
      if (s.metadata.fromCache || s.metadata.hasPendingWrites) return;
      getDocFromServer(doc(membersRef(gid), uid)).then(
        (m) => cb(m.exists() ? 'approved' : 'rejected'),
        (e) => console.warn('確認加入狀態失敗', gid, e),
      );
    },
    (e) => console.warn('讀取加入申請失敗', gid, e),
  );

function toItem(id: string, d: Record<string, unknown>): BoardItem {
  return {
    id,
    type: oneOf(ITEM_TYPES, d.type, 'note'),
    x: num(d.x, 0),
    y: num(d.y, 0),
    w: num(d.w, 200),
    h: num(d.h, 200),
    z: num(d.z, 0),
    text: str(d.text, ''),
    color: str(d.color, '#FFF3A3'),
    fontSize: num(d.fontSize, 20),
    imageData: optStr(d.imageData),
    sticker: optStr(d.sticker),
    photos: strList(d.photos),
    carousel: d.carousel === true,
    priority: oneOf(PRIORITIES, d.priority, 'none'),
    dueAt: millis(d.dueAt),
    status: oneOf(STATUSES, d.status, 'none'),
    tags: strList(d.tags),
    authorId: str(d.authorId, ''),
    authorName: str(d.authorName, ''),
    // 剛新增、伺服器時間還沒回來時先用本機時間
    createdAt: millis(d.createdAt) ?? Date.now(),
    ackBy: isRecord(d.ackBy) ? d.ackBy : {},
  };
}

export const watchItems = (gid: string, cb: (items: BoardItem[]) => void) =>
  onSnapshot(itemsRef(gid), (s) => cb(s.docs.map((d) => toItem(d.id, d.data()))));

export type NewItem = Omit<BoardItem, 'id' | 'createdAt' | 'ackBy'>;

const toFirestore = (patch: Partial<BoardItem>) => {
  const { dueAt, ...rest } = patch;
  const data: DocumentData = { ...rest };
  if (dueAt !== undefined) data.dueAt = dueAt === null ? null : Timestamp.fromMillis(dueAt);
  delete data.id;
  delete data.createdAt;
  delete data.ackBy;
  // Firestore 不接受 undefined
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
  return data;
};

export const addItem = (gid: string, item: NewItem) =>
  addDoc(itemsRef(gid), { ...toFirestore(item), createdAt: serverTimestamp(), ackBy: {} });

/** 位置 / 大小 / 圖層：任何成員都可以改 */
export const moveItem = (gid: string, id: string, geo: Partial<Pick<BoardItem, 'x' | 'y' | 'w' | 'h' | 'z'>>) =>
  updateDoc(doc(itemsRef(gid), id), geo);

/** 狀態 / 標籤：任何成員都可以改（像一起整理待辦清單） */
export const organizeItem = (gid: string, id: string, patch: Partial<Pick<BoardItem, 'status' | 'tags'>>) =>
  updateDoc(doc(itemsRef(gid), id), patch);

/** 內容：只有作者可以改（Firestore 規則也會擋）。resetAcks = 讓大家重新確認 */
export const editItem = (gid: string, id: string, patch: Partial<BoardItem>, resetAcks = false) =>
  updateDoc(doc(itemsRef(gid), id), { ...toFirestore(patch), ...(resetAcks ? { ackBy: {} } : null) });

export const acknowledge = (gid: string, id: string, uid: string) =>
  updateDoc(doc(itemsRef(gid), id), { [`ackBy.${uid}`]: serverTimestamp() });

export const deleteItem = (gid: string, id: string) => deleteDoc(doc(itemsRef(gid), id));

/* ---------- 快速通報 ---------- */

function toAlert(id: string, d: Record<string, unknown>): QuickAlert {
  return {
    id,
    emoji: str(d.emoji, '📣'),
    text: str(d.text, ''),
    level: oneOf(ALERT_LEVELS, d.level, 'normal'),
    authorId: str(d.authorId, ''),
    authorName: str(d.authorName, ''),
    // 剛送出、伺服器時間還沒回來時先用本機時間
    createdAt: millis(d.createdAt) ?? Date.now(),
    ackBy: isRecord(d.ackBy) ? d.ackBy : {},
  };
}

/** 只抓最近幾則（舊的通報留在資料庫裡，但不會再下載） */
const recentAlerts = (gid: string) => query(alertsRef(gid), orderBy('createdAt', 'desc'), limit(5));

export type NewAlert = Pick<QuickAlert, 'emoji' | 'text' | 'level' | 'authorId' | 'authorName'>;

export const addAlert = (gid: string, alert: NewAlert) =>
  addDoc(alertsRef(gid), { ...alert, createdAt: serverTimestamp(), ackBy: {} });

/** 按「收到」：每個人只能幫自己按 */
export const ackAlert = (gid: string, id: string, uid: string) =>
  updateDoc(doc(alertsRef(gid), id), { [`ackBy.${uid}`]: serverTimestamp() });

/* ---------- 公布欄摘要（桌面小工具、通報用） ---------- */

/** 活動結束超過一天的就不抓了 */
const EVENT_LOOKBACK = 86_400_000;

/**
 * 小工具只需要公告與有日期的項目，不用把整面白板（含照片）都抓下來。
 * 拆成兩個單欄位查詢，Firestore 會自動建索引，不用另外設定。
 */
const digestItemQueries = (gid: string) => [
  query(itemsRef(gid), where('priority', 'in', ['important', 'urgent'])),
  query(itemsRef(gid), where('dueAt', '>=', Timestamp.fromMillis(Date.now() - EVENT_LOOKBACK))),
];

/** 兩個查詢可能抓到同一個項目（有日期的公告），用 id 合併 */
const mergeById = (lists: BoardItem[][]) => [...new Map(lists.flat().map((i) => [i.id, i])).values()];

const itemsOf = (docs: { id: string; data: () => Record<string, unknown> }[]) =>
  docs.map((d) => toItem(d.id, d.data()));

/**
 * 即時訂閱一個公布欄的摘要；全部查詢都回來後才第一次通知，避免小工具先閃一下空的。
 * 讀取失敗（例如已經被移出群組）會呼叫 onError，摘要就不再更新。
 */
export function watchBoardDigest(gid: string, cb: (digest: BoardDigest) => void, onError: (e: unknown) => void) {
  let name: string | undefined;
  let alerts: QuickAlert[] | undefined;
  const itemLists: (BoardItem[] | undefined)[] = [undefined, undefined];
  const emit = () => {
    if (name === undefined || alerts === undefined || itemLists.some((l) => l === undefined)) return;
    cb({ gid, name, alerts, items: mergeById(itemLists as BoardItem[][]) });
  };
  const unsubs = [
    onSnapshot(
      groupRef(gid),
      (s) => {
        name = str(s.data()?.name, '公布欄');
        emit();
      },
      onError,
    ),
    onSnapshot(
      recentAlerts(gid),
      (s) => {
        alerts = s.docs.map((d) => toAlert(d.id, d.data()));
        emit();
      },
      // 讀不到通報（例如權限規則還沒更新）就當作沒有通報，公告、活動照常顯示
      (e) => {
        console.warn('讀取快速通報失敗', gid, e);
        alerts = [];
        emit();
      },
    ),
    ...digestItemQueries(gid).map((q: Query, i) =>
      onSnapshot(
        q,
        (s) => {
          itemLists[i] = itemsOf(s.docs);
          emit();
        },
        onError,
      ),
    ),
  ];
  return () => unsubs.forEach((u) => u());
}

/** 不靠畫面、抓一次摘要（App 在背景收到推播、Android 小工具定時更新時用） */
export async function fetchBoardDigest(gid: string): Promise<BoardDigest> {
  const [group, alerts, ...itemSnaps] = await Promise.all([
    getDoc(groupRef(gid)),
    // 讀不到通報就當作沒有，公告、活動照常更新
    getDocs(recentAlerts(gid)).then(
      (s) => s.docs.map((d) => toAlert(d.id, d.data())),
      () => [],
    ),
    ...digestItemQueries(gid).map((q) => getDocs(q)),
  ]);
  return {
    gid,
    name: str(group.data()?.name, '公布欄'),
    alerts,
    items: mergeById(itemSnaps.map((s) => itemsOf(s.docs))),
  };
}

/* ---------- 推播 ---------- */

export type PushOS = 'ios' | 'android';
export interface PushRecipient {
  token: string;
  os: PushOS | null;
}

/** 把這台裝置的推播代碼記在自己的成員資料上；null = 清掉（例如關掉通知權限） */
export const savePushToken = (gid: string, uid: string, token: string | null, os: PushOS) =>
  updateDoc(
    doc(membersRef(gid), uid),
    token ? { pushToken: token, pushOS: os } : { pushToken: deleteField(), pushOS: deleteField() },
  );

/** 群組裡其他人的推播代碼（自己不用通知自己） */
export async function fetchPushRecipients(gid: string, exceptUid: string): Promise<PushRecipient[]> {
  const snap = await getDocs(membersRef(gid));
  return snap.docs.flatMap((d) => {
    const data = d.data();
    if (d.id === exceptUid || typeof data.pushToken !== 'string') return [];
    const os: PushOS | null = data.pushOS === 'ios' || data.pushOS === 'android' ? data.pushOS : null;
    return [{ token: data.pushToken, os }];
  });
}
