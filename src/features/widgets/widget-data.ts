import { nextMidnights, whenLabel } from '@/lib/dates';
import {
  ALERT_TTL,
  byUrgency,
  isAckedBy,
  isAnnouncement,
  itemTitle,
  type BoardDigest,
  type BoardItem,
  type Priority,
} from '@/lib/types';

/** 一個公布欄存給小工具的原始資料（不含相對時間文字，由小工具依當下時間計算） */
export interface BoardSource {
  gid: string;
  groupName: string;
  pending: { title: string; priority: Priority; dueAt: number | null; author: string }[];
  events: { title: string; priority: Priority; dueAt: number }[];
  /** 要提醒我的快速通報：別人發的、我還沒按收到（新的在前） */
  alerts: { emoji: string; text: string; author: string; at: number; urgent: boolean }[];
}

/** App 存給桌面小工具的原始資料：每個加入的公布欄一份 */
export interface WidgetSource {
  boards: BoardSource[];
}

/**
 * 小工具目前停在哪個公布欄。at = 使用者在小工具上切換的時間（0 = 沒切換過，跟著 App）；
 * 比 at 更新的快速通報會把小工具切到發通報的公布欄。
 */
export interface BoardPick {
  gid: string;
  at: number;
  /** 翻到這個公布欄未讀清單的第幾則（從 0 開始）；沒有就是第一頁 */
  offset?: number;
}

/** 一則還沒確認（未讀）的公告 */
export interface UnreadRow {
  title: string;
  priority: Priority;
  /** 活動時間文字；沒有日期是空字串 */
  when: string;
  author: string;
}

/** 小工具最多帶幾則未讀（太多的話打開 App 看） */
export const MAX_UNREAD = 30;

/** 某個公布欄在某個時間點的畫面：只列還沒確認的公告（已讀的不顯示） */
export interface WidgetPage {
  gid: string;
  groupName: string;
  /** 點小工具：打開 App 的這個公布欄 */
  url: string;
  /** 點「通報」：打開 App 的快速通報面板 */
  alertUrl: string;
  /** 未讀公告，最需要注意的在前（最多 MAX_UNREAD 則） */
  unread: UnreadRow[];
  /** 未讀總數（可能比 unread 多） */
  unreadCount: number;
  /** 決定底色：最前面那則未讀的重要程度；都讀完是 none */
  topPriority: Priority;
  /** 正在通報中的內容；沒有通報時是空字串 */
  alertText: string;
  alertEmoji: string;
  alertBy: string;
  alertAt: number;
  alertUrgent: boolean;
}

/** 某個時間點小工具要顯示的內容：每個公布欄一頁，index 是目前顯示的那頁，offset 是翻到第幾則未讀 */
export interface WidgetView {
  pages: WidgetPage[];
  index: number;
  offset: number;
  /** 使用者在小工具上切換的時間（0 = 沒切換過）；iOS 小工具按 ‹ › 時會改這幾個值 */
  pickedAt: number;
  /** iOS「編輯小工具」固定看某個公布欄時，翻到那個公布欄的第幾則（App 重寫時間軸會回到第一頁） */
  pinGid?: string;
  pinOffset?: number;
}

/** 活動開始後還會在小工具上留多久 */
export const KEEP_AFTER_START = 3_600_000;

/** 要跟 app.json 的 scheme 一樣 */
const APP_SCHEME = 'tietieboard';
const boardUrl = (gid: string, alert = false) =>
  `${APP_SCHEME}:///?board=${encodeURIComponent(gid)}${alert ? '&alert=1' : ''}`;

const EMPTY_SOURCE: WidgetSource = { boards: [] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseBoard(raw: unknown): BoardSource | null {
  if (
    !isRecord(raw) ||
    typeof raw.gid !== 'string' ||
    typeof raw.groupName !== 'string' ||
    !Array.isArray(raw.pending) ||
    !Array.isArray(raw.events) ||
    !Array.isArray(raw.alerts)
  ) {
    return null;
  }
  return { gid: raw.gid, groupName: raw.groupName, pending: raw.pending, events: raw.events, alerts: raw.alerts };
}

/** 從儲存空間讀回來的字串還原成 WidgetSource；壞掉或是舊版格式就當作沒有資料 */
export function parseWidgetSource(raw: string | null): WidgetSource {
  if (!raw) return EMPTY_SOURCE;
  try {
    const data: unknown = JSON.parse(raw);
    if (isRecord(data) && Array.isArray(data.boards)) {
      return { boards: data.boards.map(parseBoard).filter((b): b is BoardSource => b !== null) };
    }
  } catch {
    // 格式壞掉 → 用空資料，下次打開 App 會重新寫入
  }
  return EMPTY_SOURCE;
}

export function buildWidgetSource(digests: BoardDigest[], uid: string): WidgetSource {
  return {
    boards: digests.map((d) => ({
      gid: d.gid,
      groupName: d.name,
      pending: d.items
        .filter((i) => isAnnouncement(i) && !isAckedBy(i, uid))
        .sort(byUrgency(uid))
        .map((i) => ({ title: itemTitle(i), priority: i.priority, dueAt: i.dueAt, author: i.authorName })),
      events: d.items
        .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null)
        .sort((a, b) => a.dueAt - b.dueAt)
        .map((i) => ({ title: itemTitle(i), priority: i.priority, dueAt: i.dueAt })),
      alerts: d.alerts
        .filter((a) => a.authorId !== uid && !(uid in a.ackBy))
        .map((a) => ({ emoji: a.emoji, text: a.text, author: a.authorName, at: a.createdAt, urgent: a.level === 'urgent' })),
    })),
  };
}

function pageAt(board: BoardSource, now: number): WidgetPage {
  // 有日期的公告，活動開始一段時間後就不再提醒
  const pending = board.pending.filter((p) => p.dueAt === null || p.dueAt + KEEP_AFTER_START > now);
  const alert = board.alerts.find((a) => now - a.at < ALERT_TTL);
  return {
    gid: board.gid,
    groupName: board.groupName,
    url: boardUrl(board.gid),
    alertUrl: boardUrl(board.gid, true),
    unread: pending.slice(0, MAX_UNREAD).map((p) => ({
      title: p.title,
      priority: p.priority,
      when: p.dueAt ? whenLabel(p.dueAt, now) : '',
      author: p.author,
    })),
    unreadCount: pending.length,
    topPriority: pending[0]?.priority ?? 'none',
    alertText: alert?.text ?? '',
    alertEmoji: alert?.emoji ?? '',
    alertBy: alert?.author ?? '',
    alertAt: alert?.at ?? 0,
    alertUrgent: alert?.urgent ?? false,
  };
}

/**
 * 小工具固定只看某個公布欄時：只留那一個公布欄的資料（‹ › 只翻它的未讀、不會被別的公布欄的通報搶走）。
 * 找不到（例如已經退出那個公布欄）就照舊顯示全部。
 */
export function pinSource(src: WidgetSource, gid: string | null): WidgetSource {
  const board = gid ? src.boards.find((b) => b.gid === gid) : undefined;
  return board ? { boards: [board] } : src;
}

export function viewAt(src: WidgetSource, now: number, pick: BoardPick | null): WidgetView {
  const pages = src.boards.map((b) => pageAt(b, now));
  let index = pick ? pages.findIndex((p) => p.gid === pick.gid) : -1;
  let offset = index >= 0 ? (pick?.offset ?? 0) : 0;
  // 有人剛發快速通報（比使用者上次切換還新）→ 小工具自動切到那個公布欄
  let newest = -1;
  pages.forEach((p, i) => {
    if (p.alertText && (newest < 0 || p.alertAt > pages[newest].alertAt)) newest = i;
  });
  if (newest >= 0 && pages[newest].alertAt > (pick?.at ?? 0)) {
    if (newest !== index) offset = 0;
    index = newest;
  }
  index = Math.max(0, index);
  // 確認了幾則之後清單變短：翻過頭就回到最後一則所在的位置
  const n = pages[index]?.unread.length ?? 0;
  offset = Math.max(0, Math.min(offset, n - 1));
  return { pages, index, offset, pickedAt: pick?.at ?? 0 };
}

/**
 * 按 ‹ › 之後要停在哪：先翻同一個公布欄的下一批未讀，翻完才換下一個公布欄。
 * size = 一頁放幾則（依小工具大小）。iOS 小工具不能 import 函式，BoardWidget.tsx 裡有一份一樣的邏輯。
 */
export function stepView(view: WidgetView, step: 1 | -1, size: number): { gid: string; offset: number } | null {
  const count = view.pages.length;
  const page = view.pages[view.index];
  if (!page) return null;
  const n = page.unread.length;
  const start = Math.floor(view.offset / size) * size;
  if (step > 0 && start + size < n) return { gid: page.gid, offset: start + size };
  if (step < 0 && start > 0) return { gid: page.gid, offset: start - size };
  if (count < 2) {
    // 只有一個公布欄：繞回第一頁 / 最後一頁
    if (n <= size) return null;
    return { gid: page.gid, offset: step > 0 ? 0 : Math.floor((n - 1) / size) * size };
  }
  const other = view.pages[(view.index + step + count) % count];
  const m = other.unread.length;
  return { gid: other.gid, offset: step > 0 || m === 0 ? 0 : Math.floor((m - 1) / size) * size };
}

/**
 * 小工具需要重新計算畫面的時間點：現在、每個活動開始 / 結束、每則通報過期、每天午夜。
 * 這樣就算 App 沒打開，小工具也會自動把過期的東西換掉，「明天」也會準時變「今天」。
 */
export function widgetMoments(src: WidgetSource, now: number, max = 30) {
  const moments = new Set<number>([now, ...nextMidnights(7, now)]);
  for (const board of src.boards) {
    for (const e of board.events) {
      if (e.dueAt > now) moments.add(e.dueAt);
      if (e.dueAt + KEEP_AFTER_START > now) moments.add(e.dueAt + KEEP_AFTER_START);
    }
    for (const a of board.alerts) if (a.at + ALERT_TTL > now) moments.add(a.at + ALERT_TTL);
  }
  return [...moments].sort((a, b) => a - b).slice(0, max);
}

export const FOCUS_COLORS: Record<Priority, string> = {
  urgent: '#FF5A6E',
  important: '#FF9F43',
  none: '#9A7FE0',
};

/** 快速通報時小工具整個換成這個顏色 */
export const ALERT_COLORS = { normal: '#FF6FA3', urgent: '#FF3B5C' };

export const pageColor = (page: WidgetPage) =>
  page.alertText ? ALERT_COLORS[page.alertUrgent ? 'urgent' : 'normal'] : FOCUS_COLORS[page.topPriority];
