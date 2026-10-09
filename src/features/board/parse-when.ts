import { startOfDay } from '@/lib/dates';

/**
 * 從便利貼內容認出日期、時間（台灣常見寫法），讓日期欄自動帶入。
 * 認得：今天 / 明天 / 後天 / 大後天 / 今晚、10/12、2026/10/12、10月12日（號）、12號、
 * （下）週三 / 星期三 / 禮拜三、14:00、下午3點、晚上七點半、3點15分、中午、只寫「下午」「晚上」。
 * 只認出時間 → 日期照原本的（沒有就今天）；只認出日期 → 時間照原本的
 */
export interface FoundWhen {
  date?: { y: number; m: number; d: number };
  time?: { h: number; min: number };
}

const DAY = 86_400_000;
const NUM = '[0-9０-９一二兩三四五六七八九十]{1,3}';
const WEEK: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

/** 「七」「十二」「２３」→ 數字；認不出來是 NaN */
function toNumber(raw: string): number {
  const s = raw.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  if (/^\d+$/.test(s)) return Number(s);
  const digit: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const m = s.match(/^([一二兩三四五六七八九])?(十)?([一二三四五六七八九])?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return NaN;
  if (!m[2]) return m[3] ? NaN : digit[m[1]];
  return (m[1] ? digit[m[1]] : 1) * 10 + (m[3] ? digit[m[3]] : 0);
}

const ymd = (t: number) => {
  const d = new Date(t);
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
};
const valid = (y: number, m: number, d: number) => {
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
};

function findDate(text: string, now: number): FoundWhen['date'] {
  const today = startOfDay(now);
  const rel = text.match(/(大後天|後天|明天|明早|明晚|今天|今晚|今早)/);
  if (rel) {
    const add = { 大後天: 3, 後天: 2, 明天: 1, 明早: 1, 明晚: 1 }[rel[1]] ?? 0;
    return ymd(today + add * DAY + DAY / 2);
  }
  // 2026/10/12、2026-10-12、2026.10.12
  const full = text.match(/(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})/);
  if (full) {
    const [y, m, d] = [Number(full[1]), Number(full[2]), Number(full[3])];
    if (valid(y, m, d)) return { y, m, d };
  }
  // 10/12、10月12日、十月十二號（沒寫年：已經過了就是明年）
  const md = text.match(new RegExp(`(?<![\\d/])(\\d{1,2})\\s*/\\s*(\\d{1,2})(?![\\d/])|(${NUM})\\s*月\\s*(${NUM})\\s*[日號号]?`));
  if (md) {
    const m = md[1] ? Number(md[1]) : toNumber(md[3]);
    const d = md[1] ? Number(md[2]) : toNumber(md[4]);
    const y = new Date(now).getFullYear();
    if (valid(y, m, d)) return new Date(y, m - 1, d).getTime() < today ? { y: y + 1, m, d } : { y, m, d };
  }
  // 下週三、這禮拜六、星期五（沒說哪週：今天或之後最近的那天）
  const wk = text.match(/(下下|下|這|本)?\s*(?:週|周|星期|禮拜|拜)\s*([一二三四五六日天])/);
  if (wk) {
    const target = WEEK[wk[2]];
    const dow = new Date(today).getDay();
    // 一週從星期一開始算，「這週日」是這週最後一天
    const mon = (x: number) => (x + 6) % 7;
    let add: number;
    if (wk[1] === '下' || wk[1] === '下下') add = 7 - mon(dow) + mon(target) + (wk[1] === '下下' ? 7 : 0);
    else if (wk[1]) add = mon(target) - mon(dow);
    else add = (target - dow + 7) % 7;
    return ymd(today + add * DAY + DAY / 2);
  }
  // 只寫「15號」：這個月，已經過了就下個月
  const day = text.match(new RegExp(`(?<![月/\\d])(${NUM})\\s*[號号]`));
  if (day) {
    const d = toNumber(day[1]);
    const t = new Date(now);
    for (const offset of [0, 1]) {
      const y = t.getFullYear();
      const m = t.getMonth() + 1 + offset;
      const yy = m > 12 ? y + 1 : y;
      const mm = m > 12 ? m - 12 : m;
      if (valid(yy, mm, d) && new Date(yy, mm - 1, d).getTime() >= today) return { y: yy, m: mm, d };
    }
  }
  return undefined;
}

function findTime(text: string): FoundWhen['time'] {
  const period = (h: number, p: string | undefined) => {
    if (!p) return h;
    if (/凌晨|早上|上午|早|am|AM/.test(p)) return h === 12 ? 0 : h;
    if (/中午/.test(p)) return h < 11 ? h + 12 : h;
    return h < 12 ? h + 12 : h; // 下午、傍晚、晚上、pm
  };
  const P = '(凌晨|早上|上午|中午|下午|傍晚|晚上|晚間|今晚|明晚|明早|今早|早|晚)?\\s*';
  // 14:00、下午 3:30、3:30pm
  const clock = text.match(new RegExp(`${P}(\\d{1,2})\\s*[:：]\\s*(\\d{2})\\s*(am|pm|AM|PM)?`));
  if (clock) {
    const h = period(Number(clock[2]), clock[1] ?? clock[4]);
    const min = Number(clock[3]);
    if (h < 24 && min < 60) return { h, min };
  }
  // 下午3點、晚上七點半、3點15分、10點
  // 「點心」「點點」不是時間
  const dot = text.match(new RegExp(`${P}(${NUM})\\s*[點点時](?![心點点])\\s*(半|(${NUM})\\s*分?)?`));
  if (dot) {
    const raw = toNumber(dot[2]);
    const min = dot[3] === '半' ? 30 : dot[4] ? toNumber(dot[4]) : 0;
    // 「快一點」「一點點」不是時間：沒說早晚、也沒寫幾分的「一點」不算
    const vague = dot[2] === '一' && !dot[1] && !dot[3];
    if (!vague && raw >= 0 && raw <= 24 && min >= 0 && min < 60) {
      // 沒說上午下午：1～6 點多半是下午
      const h = dot[1] ? period(raw, dot[1]) : raw >= 1 && raw <= 6 ? raw + 12 : raw;
      if (h < 24) return { h, min };
    }
  }
  // 只說早晚沒說幾點：給個常見的時間
  if (/中午/.test(text)) return { h: 12, min: 0 };
  if (/晚上|今晚|明晚|晚間/.test(text)) return { h: 19, min: 0 };
  if (/下午/.test(text)) return { h: 14, min: 0 };
  if (/早上|上午|明早|今早/.test(text)) return { h: 9, min: 0 };
  return undefined;
}

export function parseWhen(text: string, now: number): FoundWhen | null {
  const date = findDate(text, now);
  const time = findTime(text);
  return date || time ? { date, time } : null;
}

/** 認出來的日期時間套到原本的時間上：沒認出的部分照原本的（原本沒有就用 fallback） */
export function applyWhen(found: FoundWhen, current: number | null, fallback: number): number {
  const d = new Date(current ?? fallback);
  if (found.date) d.setFullYear(found.date.y, found.date.m - 1, found.date.d);
  if (found.time) d.setHours(found.time.h, found.time.min, 0, 0);
  return d.getTime();
}
