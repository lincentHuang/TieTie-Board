import { startOfDay } from '@/lib/dates';
import { byQueueOrder, isAnnouncement, type BoardItem } from '@/lib/types';

const DAY = 86_400_000;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 隊伍裡的一段：前面插一支小牌子（日期） */
export interface QueueSection {
  key: string;
  label: string;
  color: string;
  items: BoardItem[];
}

/** 排隊模式的一頁：公告、記事各一頁，左右滑切換 */
export interface QueuePage {
  key: 'notice' | 'note';
  label: string;
  icon: string;
  items: BoardItem[];
  sections: QueueSection[];
}

const COLORS = { urgent: '#FF5A6E', today: '#FF8A5B', later: '#9B7BFF', undated: '#5B9BEF', past: '#A3A3B5' };

/** 牌子上的字：「今天」「明天」「後天」「10/14（三）」 */
function dayLabel(day: number, today: number) {
  const diff = Math.round((day - today) / DAY);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === 2) return '後天';
  const d = new Date(day);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

/**
 * 依日期排、同一天一段；緊急公告不管日期都置頂成一段（裡面一樣照日期，沒日期的接在後面，越新越前面）：
 * 緊急 → 今天以後有日期的照日期先後（開始了還沒結束的算今天）→ 沒日期的（緊急、重要、越新越前面，貼圖最後）→ 已經過去的（最近的在前）
 */
export function dateSections(items: BoardItem[], now: number): QueueSection[] {
  const today = startOfDay(now);
  // 有結束時間的看結束：還沒結束（進行中）的排在今天
  const lastDay = (i: BoardItem) => i.endAt ?? i.dueAt ?? 0;
  const shownDay = (i: BoardItem & { dueAt: number }) => Math.max(startOfDay(i.dueAt), today);
  // 已經過去的緊急公告不再置頂，回到「已經過了」
  const isPinned = (i: BoardItem) => i.priority === 'urgent' && (i.dueAt === null || lastDay(i) >= today);
  const pinned = items.filter(isPinned);
  items = items.filter((i) => !isPinned(i));
  const pinnedDated = pinned
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null)
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  const pinnedUndated = pinned.filter((i) => i.dueAt === null).sort(byQueueOrder(now));
  const upcoming = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && lastDay(i) >= today)
    .sort((a, b) => shownDay(a) - shownDay(b) || a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  const undated = items.filter((i) => i.dueAt === null).sort(byQueueOrder(now));
  const past = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && lastDay(i) < today)
    .sort((a, b) => b.dueAt - a.dueAt || a.id.localeCompare(b.id));

  const sections: QueueSection[] = [];
  if (pinned.length) {
    sections.push({ key: 'urgent', label: '⚠️ 緊急', color: COLORS.urgent, items: [...pinnedDated, ...pinnedUndated] });
  }
  for (const item of upcoming) {
    const day = shownDay(item);
    const last = sections.at(-1);
    if (last?.key === `d${day}`) last.items.push(item);
    else
      sections.push({
        key: `d${day}`,
        label: dayLabel(day, today),
        color: day === today ? COLORS.today : COLORS.later,
        items: [item],
      });
  }
  if (undated.length) sections.push({ key: 'undated', label: '沒有日期', color: COLORS.undated, items: undated });
  if (past.length) sections.push({ key: 'past', label: '已經過了', color: COLORS.past, items: past });
  return sections;
}

/** 公告（要大家按「我知道了」的）一頁、其他記事一頁 */
export function queuePages(items: BoardItem[], now: number): QueuePage[] {
  const pages = [
    { key: 'notice' as const, label: '公告', icon: '📢', items: items.filter(isAnnouncement) },
    { key: 'note' as const, label: '記事', icon: '📝', items: items.filter((i) => !isAnnouncement(i)) },
  ];
  return pages.map((p) => ({ ...p, sections: dateSections(p.items, now) }));
}
