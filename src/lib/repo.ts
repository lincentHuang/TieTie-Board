import { getRandomBytes } from 'expo-crypto';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  addDoc,
  type DocumentData,
} from 'firebase/firestore';

import { db } from './firebase';

import { STATUSES, type BoardItem, type ItemStatus, type Member } from './types';

/**
 * Firestore 結構：
 *   groups/{邀請碼}                 name, ownerId, createdAt
 *   groups/{邀請碼}/members/{uid}   name, joinedAt
 *   groups/{邀請碼}/items/{id}      BoardItem（白板上的便利貼 / 圖片 / 貼圖 / 公告）
 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易看錯的 0/O/1/I

const groupRef = (gid: string) => doc(db, 'groups', gid);
const itemsRef = (gid: string) => collection(db, 'groups', gid, 'items');
const membersRef = (gid: string) => collection(db, 'groups', gid, 'members');

export const normalizeCode = (input: string) => input.trim().toUpperCase();

function randomCode() {
  const bytes = getRandomBytes(6);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export async function createGroup(name: string, uid: string, nickname: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const created = await runTransaction(db, async (tx) => {
      if ((await tx.get(groupRef(code))).exists()) return false;
      tx.set(groupRef(code), { name, ownerId: uid, createdAt: serverTimestamp() });
      return true;
    });
    if (created) {
      await joinGroup(code, uid, nickname);
      return code;
    }
  }
  throw new Error('無法產生邀請碼，請再試一次');
}

/** 邀請碼不存在時回傳 false */
export async function joinGroup(gid: string, uid: string, nickname: string) {
  if (!(await getDoc(groupRef(gid))).exists()) return false;
  await setDoc(doc(membersRef(gid), uid), { name: nickname, joinedAt: serverTimestamp() }, { merge: true });
  return true;
}

export const leaveGroup = (gid: string, uid: string) => deleteDoc(doc(membersRef(gid), uid));

export const watchGroupName = (gid: string, cb: (name: string) => void) =>
  onSnapshot(groupRef(gid), (s) => cb((s.data()?.name as string) ?? '公布欄'));

export const watchMembers = (gid: string, cb: (members: Member[]) => void) =>
  onSnapshot(membersRef(gid), (s) =>
    cb(s.docs.map((d) => ({ uid: d.id, name: (d.data().name as string) ?? '（未命名）' }))),
  );

const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);

function toItem(id: string, d: DocumentData): BoardItem {
  return {
    id,
    type: d.type ?? 'note',
    x: d.x ?? 0,
    y: d.y ?? 0,
    w: d.w ?? 200,
    h: d.h ?? 200,
    z: d.z ?? 0,
    text: d.text ?? '',
    color: d.color ?? '#FFF3A3',
    fontSize: d.fontSize ?? 20,
    imageData: d.imageData,
    sticker: d.sticker,
    priority: d.priority ?? 'none',
    dueAt: millis(d.dueAt),
    status: STATUSES.includes(d.status) ? (d.status as ItemStatus) : 'none',
    tags: Array.isArray(d.tags) ? d.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    authorId: d.authorId ?? '',
    authorName: d.authorName ?? '',
    // 剛新增、伺服器時間還沒回來時先用本機時間
    createdAt: millis(d.createdAt) ?? Date.now(),
    ackBy: d.ackBy ?? {},
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
