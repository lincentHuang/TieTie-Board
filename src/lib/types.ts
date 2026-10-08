import { richTitle } from './rich-text';

export type ItemType = 'note' | 'image' | 'sticker';
export const ITEM_TYPES: ItemType[] = ['note', 'image', 'sticker'];

/** none = 一般便利貼；important / urgent = 公告，需要大家按「我知道了」 */
export type Priority = 'none' | 'important' | 'urgent';
export const PRIORITIES: Priority[] = ['none', 'important', 'urgent'];

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
  /** 便利貼 / 公告附的照片（壓縮後的 data URL），最多 MAX_PHOTOS 張；第一張是封面 */
  photos: string[];
  /** 白板上輪流播放所有照片；關掉時只放封面 */
  carousel: boolean;
  /** 附件（PDF、Word…），最多 MAX_FILES 個；檔案內容另外存，點開時才下載 */
  files: Attachment[];
  /** 貼圖：emoji */
  sticker?: string;
  /** 待辦清單（沒有就是空的）：寫哪幾項跟文字一樣，只有能改內容的人能改 */
  tasks: Task[];
  /** 打勾了的待辦：task id → 打勾的人（uid）。大家都可以勾 / 取消 */
  checked: Record<string, string>;

  priority: Priority;
  /** 活動日期時間（毫秒），沒有則為 null */
  dueAt: number | null;
  status: ItemStatus;
  /** 標籤（不含 #），大家都可以改 */
  tags: string[];

  authorId: string;
  authorName: string;
  /** 作者同意可以改內容的人（uid）；房主不用在這裡也能改 */
  editors: string[];
  createdAt: number | null;
  /** uid → 確認時間 */
  ackBy: Record<string, unknown>;
}

/** 待辦清單的一項 */
export interface Task {
  /** 隨機產生的英數字，也是 checked 的 key */
  id: string;
  text: string;
}

/** 一張最多幾項待辦、一項最多幾個字（Firestore 規則也會擋項數） */
export const MAX_TASKS = 30;
export const MAX_TASK_TEXT = 60;

/** 用 typeof 判斷，不會被 constructor 之類的內建屬性騙到 */
export const isTaskDone = (item: Pick<BoardItem, 'checked'>, taskId: string) => typeof item.checked[taskId] === 'string';

/** 待辦清單做了幾項 */
export const taskProgress = (item: Pick<BoardItem, 'tasks' | 'checked'>) => ({
  done: item.tasks.filter((t) => isTaskDone(item, t.id)).length,
  total: item.tasks.length,
});

/** 整張做完了：狀態標成完成，或待辦清單全部勾完 */
export const isItemDone = (item: Pick<BoardItem, 'status' | 'tasks' | 'checked'>) =>
  item.status === 'done' || (item.tasks.length > 0 && item.tasks.every((t) => isTaskDone(item, t.id)));

/** 作者、房主、作者同意過的人可以改內容 */
export const canEditItem = (item: BoardItem, uid: string, ownerId: string) =>
  item.authorId === uid || ownerId === uid || item.editors.includes(uid);

/** 作者和房主可以刪掉 */
export const canDeleteItem = (item: BoardItem, uid: string, ownerId: string) =>
  item.authorId === uid || ownerId === uid;

/** 想改別人貼的東西：要作者同意，同意後就能一直改那一張（文件 id = 項目 id + _ + 申請的人） */
export interface EditRequest {
  id: string;
  itemId: string;
  /** 項目的作者：要他同意 */
  authorId: string;
  requesterId: string;
  requesterName: string;
  /** 毫秒；剛送出、伺服器時間還沒回來時是 null */
  createdAt: number | null;
}

/** 便利貼 / 公告附的檔案。內容切成好幾片另外存（見 repo 的 uploadFile），項目上只記這些 */
export interface Attachment {
  /** 隨機產生，也是檔案內容存放的位置 */
  id: string;
  /** 原始檔名（含副檔名） */
  name: string;
  /** 位元組 */
  size: number;
  mime: string;
}

/** 一個項目最多附幾個檔案 */
export const MAX_FILES = 5;
/** 單一檔案上限。檔案切片存在 Firestore（免費方案共 1GB），太大的請改傳雲端硬碟連結 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** 每一片的大小：Firestore 單一文件上限 1MB，留一點空間給其他欄位（Firestore 規則也會擋） */
export const FILE_CHUNK_BYTES = 900 * 1024;

export const chunkCount = (size: number) => Math.max(1, Math.ceil(size / FILE_CHUNK_BYTES));

export const isPdf = (file: Pick<Attachment, 'name' | 'mime'>) =>
  file.mime === 'application/pdf' || /\.pdf$/i.test(file.name);

/** 1.2 MB、10 MB、350 KB */
export const fileSizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** 檔案一樣就好、順序不管 */
export const sameFileSet = (a: Attachment[], b: Attachment[]) =>
  a.length === b.length && a.every((f) => b.some((g) => g.id === f.id));

/** 白板上的位置與大小 */
export type Geometry = Pick<BoardItem, 'x' | 'y' | 'w' | 'h'>;

/** 成員在公布欄上顯示的樣子：用 LINE / Google 登入的人會帶那邊的名字和大頭貼 */
export interface MemberProfile {
  name: string;
  /** LINE / Google 大頭貼網址；沒有就顯示名字的第一個字 */
  avatarUrl: string | null;
}

/** 頭像會顯示在每個人的畫面上，只接受 LINE 和 Google 的大頭貼網址（Firestore 規則也會擋） */
export const isAvatarUrl = (url: string) =>
  url.length <= 300 && /^https:\/\/(profile\.line-scdn\.net|lh3\.googleusercontent\.com)\/\S+$/.test(url);

export interface Member extends MemberProfile {
  uid: string;
}

/** 公布欄本身：名稱與房主（建立的人，負責同意加入申請） */
export interface GroupInfo {
  name: string;
  ownerId: string;
}

/** 等房主同意的加入申請（不是從綁定的 LINE 群組點連結進來的人） */
export interface JoinRequest extends Member {
  /** 毫秒；剛送出、伺服器時間還沒回來時是 null */
  createdAt: number | null;
}

/** 我的公布欄（依加入順序） */
export interface Boards {
  /** 已經加入的 */
  groupIds: string[];
  /** 送出申請、等房主同意的 */
  pendingIds: string[];
}

/** 自己在某個公布欄的狀態：joined = 成員；pending = 等房主同意；null = 都不是（離開了、被拒絕、收回申請） */
export type BoardState = 'joined' | 'pending' | null;

/**
 * 我送出的加入申請現在怎樣了：
 * pending = 還在等；approved = 房主同意了（已經是成員）；rejected = 房主拒絕了，或公布欄不見了
 */
export type JoinStatus = 'pending' | 'approved' | 'rejected';

/** 快速通報：一按就讓全家的手機跳通知、桌面小工具變色提醒；urgent 會用更醒目的紅色 */
export type AlertLevel = 'normal' | 'urgent';
export const ALERT_LEVELS: AlertLevel[] = ['normal', 'urgent'];

export interface QuickAlert {
  id: string;
  emoji: string;
  text: string;
  level: AlertLevel;
  authorId: string;
  authorName: string;
  createdAt: number;
  /** uid → 按「收到」的時間 */
  ackBy: Record<string, unknown>;
}

/** 快速通報的按鈕（模組）：每個人自己設定、跟著帳號走，按一下就用這句話通報 */
export interface AlertPreset {
  /** 本機產生，只用來分辨是哪一顆 */
  id: string;
  emoji: string;
  text: string;
  level: AlertLevel;
}

/** 最多幾顆快速通報按鈕（Firestore 規則也會擋） */
export const MAX_ALERT_PRESETS = 12;

/** 這則通報是不是用這顆按鈕發的（通報上沒記按鈕，用表情和文字比對） */
export const isFromPreset = (alert: Pick<QuickAlert, 'emoji' | 'text'>, preset: Pick<AlertPreset, 'emoji' | 'text'>) =>
  alert.text === preset.text && alert.emoji === preset.emoji;

/** 通報在 App 與小工具上停留多久（之後就當作過去了） */
export const ALERT_TTL = 30 * 60_000;
export const MAX_ALERT_TEXT = 40;

export const isAlertActive = (alert: QuickAlert, now: number) => now - alert.createdAt < ALERT_TTL;

/** 要提醒我的通報：別人發的、還在時效內、我還沒按收到 */
export const isAlertForMe = (alert: QuickAlert, uid: string, now: number) =>
  alert.authorId !== uid && !(uid in alert.ackBy) && isAlertActive(alert, now);

/** 一個公布欄給小工具與通報用的摘要：只有公告、有日期的項目與最近的通報（不含一般便利貼，資料量小） */
export interface BoardDigest {
  gid: string;
  name: string;
  items: BoardItem[];
  /** 新的在前 */
  alerts: QuickAlert[];
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
/** 一張便利貼最多幾張照片（含封面）。Firestore 單一文件上限 1MB，照片都存在同一份文件裡 */
export const MAX_PHOTOS = 5;
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

/** 取得公告的標題：標成標題的那行，沒有就用第一行（去掉格式記號）；只寫了待辦就叫「待辦清單」；只放了檔案就用檔名 */
export const itemTitle = (item: Pick<BoardItem, 'type' | 'text' | 'sticker' | 'photos' | 'files' | 'tasks'>) => {
  if (item.type === 'image') return richTitle(item.text) || '圖片';
  if (item.type === 'sticker') return item.sticker ?? '貼圖';
  return (
    richTitle(item.text) ||
    (item.tasks.length ? '待辦清單' : item.photos.length ? '照片' : (item.files[0]?.name ?? '（沒有文字）'))
  );
};

/** 點開來可以放大看的照片：拍立得是那一張，便利貼是附的照片 */
export const viewablePhotos = (item: BoardItem) =>
  item.type === 'image' ? (item.imageData ? [item.imageData] : []) : item.photos;

/** 照片一樣就好、順序不管（換封面只是換順序，不算改了公告內容） */
export const samePhotoSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((p, i) => p === sorted[i]);
};

/** 排隊模式的順序（跟誰在看無關，大家看到的隊伍都一樣）：完成的（含待辦全部勾完的）排到最後，緊急 > 重要 > 一般，貼圖排最後，快到的活動在前，其餘越新越前面 */
export const byQueueOrder = (now: number) => (a: BoardItem, b: BoardItem) => {
  const done = Number(isItemDone(a)) - Number(isItemDone(b));
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
