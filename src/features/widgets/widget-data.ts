import { countdownLabel, nextMidnights, whenLabel } from '@/lib/dates';
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
}

/** 某個公布欄在某個時間點的畫面 */
export interface WidgetPage {
  gid: string;
  groupName: string;
  /** 點小工具：打開 App 的這個公布欄 */
  url: string;
  /** 點「通報」：打開 App 的快速通報面板 */
  alertUrl: string;
  pendingCount: number;
  focusTitle: string;
  focusPriority: Priority;
  focusWhen: string;
  /** 倒數的目標時間（毫秒），iOS 會用系統的自動倒數文字 */
  focusDueAt: number;
  focusCountdown: string;
  focusBadge: string;
  upcoming: { when: string; title: string; urgent: boolean }[];
  /** 正在通報中的內容；沒有通報時是空字串 */
  alertText: string;
  alertEmoji: string;
  alertBy: string;
  alertAt: number;
  alertUrgent: boolean;
}

/** 某個時間點小工具要顯示的內容：每個公布欄一頁，index 是目前顯示的那頁 */
export interface WidgetView {
  pages: WidgetPage[];
  index: number;
  /** 使用者在小工具上切換的時間（0 = 沒切換過）；iOS 小工具按 ‹ › 時會改這兩個值 */
  pickedAt: number;
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
  const events = board.events.filter((e) => e.dueAt + KEEP_AFTER_START > now);
  const pending = board.pending.filter((p) => p.dueAt === null || p.dueAt + KEEP_AFTER_START > now);
  const alert = board.alerts.find((a) => now - a.at < ALERT_TTL);
  const top = pending[0];
  const next = events[0];

  let focus: { title: string; priority: Priority; dueAt: number | null } | undefined;
  let focusBadge = '';
  if (top) {
    focus = top;
    const label = top.priority === 'urgent' ? '緊急' : '重要';
    focusBadge = pending.length > 1 ? `⚠︎ ${label}・還有 ${pending.length} 則未確認` : `⚠︎ ${label}・你還沒確認`;
  } else if (next) {
    focus = next;
    focusBadge = '📅 下一件事';
  }

  return {
    gid: board.gid,
    groupName: board.groupName,
    url: boardUrl(board.gid),
    alertUrl: boardUrl(board.gid, true),
    pendingCount: pending.length,
    focusTitle: focus?.title ?? '目前沒有重要的事',
    focusPriority: focus?.priority ?? 'none',
    focusWhen: focus?.dueAt ? whenLabel(focus.dueAt, now) : '',
    focusDueAt: focus?.dueAt ?? 0,
    focusCountdown: focus?.dueAt ? countdownLabel(focus.dueAt, now) : '',
    focusBadge: focusBadge || '✓ 都看過了',
    upcoming: events
      .filter((e) => e.title !== focus?.title || e.dueAt !== focus?.dueAt)
      .slice(0, 4)
      .map((e) => ({ when: whenLabel(e.dueAt, now), title: e.title, urgent: e.priority === 'urgent' })),
    alertText: alert?.text ?? '',
    alertEmoji: alert?.emoji ?? '',
    alertBy: alert?.author ?? '',
    alertAt: alert?.at ?? 0,
    alertUrgent: alert?.urgent ?? false,
  };
}

export function viewAt(src: WidgetSource, now: number, pick: BoardPick | null): WidgetView {
  const pages = src.boards.map((b) => pageAt(b, now));
  let index = pick ? pages.findIndex((p) => p.gid === pick.gid) : -1;
  // 有人剛發快速通報（比使用者上次切換還新）→ 小工具自動切到那個公布欄
  let newest = -1;
  pages.forEach((p, i) => {
    if (p.alertText && (newest < 0 || p.alertAt > pages[newest].alertAt)) newest = i;
  });
  if (newest >= 0 && pages[newest].alertAt > (pick?.at ?? 0)) index = newest;
  return { pages, index: Math.max(0, index), pickedAt: pick?.at ?? 0 };
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
  page.alertText ? ALERT_COLORS[page.alertUrgent ? 'urgent' : 'normal'] : FOCUS_COLORS[page.focusPriority];
