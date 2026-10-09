const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');
export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const timeOfDay = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 相對於 now 的日期文字：「今天 14:00」「明天 09:30」「10/3（五）14:00」 */
export function whenLabel(t: number, now = Date.now()) {
  const days = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  const d = new Date(t);
  const hm = timeOfDay(t);
  if (days === 0) return `今天 ${hm}`;
  if (days === 1) return `明天 ${hm}`;
  if (days === 2) return `後天 ${hm}`;
  if (days === -1) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）${hm}`;
}

/**
 * 一段時間的文字：同一天「今天 14:00–16:00」，跨天「10/14（三）09:00 ～ 10/16（五）18:00」；
 * 沒有結束就跟 whenLabel 一樣
 */
export function rangeLabel(start: number, end: number | null, now = Date.now()) {
  if (end === null) return whenLabel(start, now);
  if (startOfDay(start) === startOfDay(end)) return `${whenLabel(start, now)}–${timeOfDay(end)}`;
  return `${whenLabel(start, now)} ～ ${whenLabel(end, now)}`;
}

/** 倒數文字：「還有 3 天」「還有 2 小時」「進行中」「已結束」；有結束時間的話，結束前都算進行中 */
export function countdownLabel(t: number, now = Date.now(), end: number | null = null) {
  const diff = t - now;
  if (end !== null && diff <= 0) return now <= end ? '進行中' : '已結束';
  if (diff < -3_600_000) return '已結束';
  if (diff <= 0) return '進行中';
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return `還有 ${min} 分鐘`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `還有 ${hours} 小時`;
  const days = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  return `還有 ${days} 天`;
}

export function timeAgo(t: number | null, now = Date.now()) {
  if (!t) return '剛剛';
  const diff = now - t;
  if (diff < 60_000) return '剛剛';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} 小時前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 接下來幾天的午夜時間點（小工具在換日時要重新計算「今天/明天」） */
export function nextMidnights(count: number, now = Date.now()) {
  const first = startOfDay(now) + DAY;
  return Array.from({ length: count }, (_, i) => first + i * DAY);
}
