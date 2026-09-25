import { countdownLabel, whenLabel } from './dates';
import { byUrgency, isAckedBy, isAnnouncement, itemTitle, type BoardItem, type Priority } from './types';

/** App 存給桌面小工具的原始資料（不含相對時間文字，由小工具依當下時間計算） */
export interface WidgetSource {
  groupName: string;
  pending: { title: string; priority: Priority; dueAt: number | null; author: string }[];
  events: { title: string; priority: Priority; dueAt: number }[];
}

/** 某個時間點小工具要顯示的內容 */
export interface WidgetView {
  groupName: string;
  pendingCount: number;
  focusTitle: string;
  focusPriority: Priority;
  focusWhen: string;
  /** 倒數的目標時間（毫秒），iOS 會用系統的自動倒數文字 */
  focusDueAt: number;
  focusCountdown: string;
  focusBadge: string;
  upcoming: { when: string; title: string; urgent: boolean }[];
}

/** 活動開始後還會在小工具上留多久 */
const KEEP_AFTER_START = 3_600_000;

export function buildWidgetSource(items: BoardItem[], uid: string, groupName: string): WidgetSource {
  const pending = items
    .filter((i) => isAnnouncement(i) && !isAckedBy(i, uid))
    .sort(byUrgency(uid))
    .map((i) => ({ title: itemTitle(i), priority: i.priority, dueAt: i.dueAt, author: i.authorName }));
  const events = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null)
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((i) => ({ title: itemTitle(i), priority: i.priority, dueAt: i.dueAt }));
  return { groupName, pending, events };
}

export function viewAt(src: WidgetSource, now: number): WidgetView {
  const events = src.events.filter((e) => e.dueAt + KEEP_AFTER_START > now);
  const pending = src.pending.filter((p) => p.dueAt === null || p.dueAt + KEEP_AFTER_START > now);
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
    groupName: src.groupName,
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
  };
}

export const FOCUS_COLORS: Record<Priority, string> = {
  urgent: '#FF5A6E',
  important: '#FF9F43',
  none: '#9A7FE0',
};
