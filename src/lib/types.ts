export type ItemType = 'note' | 'image' | 'sticker';

/** none = 一般便利貼；important / urgent = 公告，需要大家按「我知道了」 */
export type Priority = 'none' | 'important' | 'urgent';

/** 像待辦清單的進度，大家都可以改；none = 不需要追蹤 */
export type ItemStatus = 'none' | 'todo' | 'doing' | 'done';

export interface BoardItem {
  id: string;
  type: ItemType;
  /** 白板座標（左上角）與大小 */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;

  text: string;
  color: string;
  fontSize: number;
  /** 圖片：壓縮後的 data URL */
  imageData?: string;
  /** 貼圖：emoji */
  sticker?: string;

  priority: Priority;
  /** 活動日期時間（毫秒），沒有則為 null */
  dueAt: number | null;
  status: ItemStatus;
  /** 標籤（不含 #），大家都可以改 */
  tags: string[];

  authorId: string;
  authorName: string;
  createdAt: number | null;
  /** uid → 確認時間 */
  ackBy: Record<string, unknown>;
}

export interface Member {
  uid: string;
  name: string;
}

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  none: { label: '一般', color: '#8C84A8' },
  important: { label: '重要', color: '#FF9F43' },
  urgent: { label: '緊急', color: '#FF5A6E' },
};

export const STATUS_META: Record<ItemStatus, { label: string; icon: string; color: string }> = {
  none: { label: '沒有狀態', icon: '・', color: '#8C84A8' },
  todo: { label: '待辦', icon: '○', color: '#7CB8FF' },
  doing: { label: '進行中', icon: '◐', color: '#FF9F43' },
  done: { label: '完成', icon: '✓', color: '#3CC49A' },
};
export const STATUSES: ItemStatus[] = ['none', 'todo', 'doing', 'done'];

export const MAX_TAGS = 5;
/** 還沒有人用過標籤時，先給幾個家裡常用的 */
export const STARTER_TAGS = ['家事', '採買', '學校', '繳費', '出遊'];

/** 去掉前面的 #、空白，太長的截掉 */
export const normalizeTag = (raw: string) => raw.trim().replace(/^#+/, '').replace(/\s+/g, '').slice(0, 12);

const KEY_COLORS = ['#FF6FA3', '#3CC49A', '#5B9BEF', '#9B7BFF', '#FF9F43', '#E0A800', '#FF7474', '#2FB5D8'];
/** 同一個字串（標籤、成員 uid）在每個人的手機上都是同一個顏色 */
export const colorOf = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return KEY_COLORS[Math.abs(h) % KEY_COLORS.length];
};
export const tagColor = colorOf;

/** 白板上所有用過的標籤，用越多次的排越前面 */
export const tagsInUse = (items: BoardItem[]) => {
  const count = new Map<string, number>();
  for (const item of items) for (const tag of item.tags) count.set(tag, (count.get(tag) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, n]) => ({ tag, count: n }));
};

export const NOTE_COLORS = ['#FFF1B8', '#FFD9C7', '#FFD1E0', '#CFF3E6', '#D6E9FF', '#E6DCFF', '#FFFFFF'];

export const isAnnouncement = (item: BoardItem) => item.priority !== 'none';

/** 作者本人視為已確認 */
export const isAckedBy = (item: BoardItem, uid: string) =>
  !isAnnouncement(item) || item.authorId === uid || uid in item.ackBy;

/** 取得公告的標題：第一行文字 */
export const itemTitle = (item: BoardItem) => {
  if (item.type === 'image') return item.text.split('\n')[0] || '圖片';
  if (item.type === 'sticker') return item.sticker ?? '貼圖';
  return item.text.split('\n')[0] || '（沒有文字）';
};

/** 排隊模式的順序（跟誰在看無關，大家看到的隊伍都一樣）：完成的排到最後，緊急 > 重要 > 一般，貼圖排最後，快到的活動在前，其餘越新越前面 */
export const byQueueOrder = (now: number) => (a: BoardItem, b: BoardItem) => {
  const done = Number(a.status === 'done') - Number(b.status === 'done');
  if (done) return done;
  const rank = { urgent: 2, important: 1, none: 0 };
  const pri = rank[b.priority] - rank[a.priority];
  if (pri) return pri;
  const sticker = Number(a.type === 'sticker') - Number(b.type === 'sticker');
  if (sticker) return sticker;
  const aSoon = a.dueAt !== null && a.dueAt > now;
  const bSoon = b.dueAt !== null && b.dueAt > now;
  if (aSoon && bSoon) return a.dueAt! - b.dueAt!;
  if (aSoon !== bSoon) return aSoon ? -1 : 1;
  return (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.id.localeCompare(b.id);
};

/** 越需要注意的排越前面：沒確認 > 緊急 > 重要 > 活動時間越近 > 越新 */
export const byUrgency = (uid: string) => (a: BoardItem, b: BoardItem) => {
  const ack = Number(isAckedBy(a, uid)) - Number(isAckedBy(b, uid));
  if (ack) return ack;
  const rank = { urgent: 2, important: 1, none: 0 };
  const pri = rank[b.priority] - rank[a.priority];
  if (pri) return pri;
  if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
  if (a.dueAt || b.dueAt) return a.dueAt ? -1 : 1;
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
};
