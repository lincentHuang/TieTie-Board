import { startOfDay } from '@/lib/dates';
import { isAnnouncement, type BoardItem } from '@/lib/types';

/** 某一天的開始時間（毫秒）當作日期的 key */
export type DayKey = number;

/** 項目落在哪一天：有日期的看日期；沒日期的公告看發布那天；其他沒日期的不上月曆 */
export function dayOf(item: BoardItem): DayKey | null {
  if (item.dueAt !== null) return startOfDay(item.dueAt);
  if (isAnnouncement(item) && item.createdAt !== null) return startOfDay(item.createdAt);
  return null;
}

/** 某月的格子：從那個月 1 號所在那週的星期日開始，補滿整週；不屬於這個月的格子是 null */
export function monthGrid(year: number, month: number): (DayKey | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (DayKey | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d).getTime());
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** 跨好幾天的活動最多畫幾天（打錯年份時不要塞滿整個月曆） */
const MAX_SPAN_DAYS = 62;

/** 項目佔哪幾天：有結束時間的從開始那天到結束那天，每天都算 */
function daysOf(item: BoardItem): DayKey[] {
  const first = dayOf(item);
  if (first === null) return [];
  if (item.endAt === null) return [first];
  const days: DayKey[] = [];
  const last = startOfDay(item.endAt);
  // 用日期加一天而不是加 24 小時：遇到日光節約時間也不會跳號
  for (const d = new Date(first); d.getTime() <= last && days.length < MAX_SPAN_DAYS; d.setDate(d.getDate() + 1)) {
    days.push(d.getTime());
  }
  return days;
}

/** 每一天有哪些項目（依時間排：有時間的照時間，沒時間的照發布時間） */
export function itemsByDay(items: BoardItem[]) {
  const map = new Map<DayKey, BoardItem[]>();
  for (const i of items) {
    for (const day of daysOf(i)) map.set(day, [...(map.get(day) ?? []), i]);
  }
  const at = (i: BoardItem) => i.dueAt ?? i.createdAt ?? 0;
  for (const list of map.values()) list.sort((a, b) => at(a) - at(b));
  return map;
}
