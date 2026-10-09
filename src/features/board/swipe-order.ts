import { startOfDay } from '@/lib/dates';
import { byQueueOrder, type BoardItem } from '@/lib/types';

const DAY = 86_400_000;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export interface FeedSection {
  key: string;
  label: string;
  items: BoardItem[];
}

/** 段落標題：「今天」「明天」「後天」「10/14（三）」 */
function dayLabel(day: number, today: number) {
  const diff = Math.round((day - today) / DAY);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === 2) return '後天';
  const d = new Date(day);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

/**
 * 滑動模式的順序：依日期先排，同一天一段。
 * 今天以後有日期的照日期先後（一天一段）→ 沒日期的（照排隊順序：緊急、重要、越新越前面）→ 已經過去的日期（最近的在前）。
 * 貼圖不算
 */
export function feedSections(items: BoardItem[], now: number): FeedSection[] {
  const today = startOfDay(now);
  const cards = items.filter((i) => i.type !== 'sticker');
  const upcoming = cards
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt >= today)
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  const undated = cards.filter((i) => i.dueAt === null).sort(byQueueOrder(now));
  const past = cards
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt < today)
    .sort((a, b) => b.dueAt - a.dueAt || a.id.localeCompare(b.id));

  const sections: FeedSection[] = [];
  for (const item of upcoming) {
    const day = startOfDay(item.dueAt);
    const last = sections.at(-1);
    if (last?.key === `d${day}`) last.items.push(item);
    else sections.push({ key: `d${day}`, label: dayLabel(day, today), items: [item] });
  }
  if (undated.length) sections.push({ key: 'undated', label: '沒有日期', items: undated });
  if (past.length) sections.push({ key: 'past', label: '已經過了', items: past });
  return sections;
}
