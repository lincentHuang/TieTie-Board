import { startOfDay } from '@/lib/dates';

/**
 * 從便利貼內容認出日期、時間（台灣常見寫法），讓日期欄自動帶入。
 * 認得：今天 / 明天 / 後天 / 大後天 / 今晚、10/12、2026/10/12、10月12日（號）、12號、
 * （下）週三 / 星期三 / 禮拜三、14:00、下午3點、晚上七點半、3點15分、中午、只寫「下午」「晚上」。
 * 兩個時間中間是「~ - 到 至」就是一段時間（開始～結束），例如「10/14~10/16」「下午2點到4點」「週三至週五」。
 * 只認出時間 → 日期照原本的（沒有就今天）；只認出日期 → 時間照原本的
 */
interface Ymd {
  y: number;
  m: number;
  d: number;
}
interface Hm {
  h: number;
  min: number;
  /** 沒寫早上下午、12 小時制看得出兩種可能（「10點」「1:30」）：當結束時間時看開始來決定 */
  loose?: boolean;
}
interface Moment {
  date?: Ymd;
  time?: Hm;
}
export interface FoundWhen extends Moment {
  /** 有寫結束的話 */
  end?: Moment;
}

const DAY = 86_400_000;
const NUM = '[0-9０-９一二兩三四五六七八九十]{1,3}';
const WEEK: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const PERIOD = '(凌晨|早上|上午|中午|下午|傍晚|晚上|晚間|今晚|明晚|明早|今早|早|晚)?\\s*';
/** 兩個時間中間只有這些字：是一段時間 */
const RANGE_GAP = /^\s*(?:~|～|〜|-|–|—|到|至)\s*$/;
/** 同一個時間點的日期和時間中間只隔這些（「週六 9:00」「10/12的下午3點」） */
const SAME_GAP = /^[\s,，、的]*$/;

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

const ymd = (t: number): Ymd => {
  const d = new Date(t);
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
};
const valid = (y: number, m: number, d: number) => {
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
};

/** 上午 / 下午 / 晚上 → 24 小時制 */
const withPeriod = (h: number, p: string | undefined) => {
  if (!p) return h;
  if (/凌晨|早上|上午|早|am|AM/.test(p)) return h === 12 ? 0 : h;
  if (/中午/.test(p)) return h < 11 ? h + 12 : h;
  return h < 12 ? h + 12 : h; // 下午、傍晚、晚上、pm
};

type Token = { start: number; end: number; date?: Ymd; time?: Hm; weak?: boolean };
type Rule = {
  re: RegExp;
  date?: (m: RegExpMatchArray) => Ymd | null;
  time?: (m: RegExpMatchArray) => Hm | null;
  /** 只說早晚沒說幾點：有寫幾點的話以幾點為準 */
  weak?: boolean;
};

/** 每一種寫法：一個 regex ＋ 怎麼換成日期 / 時間（換不出來回傳 null） */
function scan(text: string, now: number): Token[] {
  const today = startOfDay(now);
  const year = new Date(now).getFullYear();
  const day = (add: number) => ymd(today + add * DAY + DAY / 2);
  /** 沒寫年：已經過了就是明年 */
  const md = (m: number, d: number): Ymd | null =>
    valid(year, m, d) ? (new Date(year, m - 1, d).getTime() < today ? { y: year + 1, m, d } : { y: year, m, d }) : null;

  const rules: Rule[] = [
    {
      re: /(大後天|後天|明天|明早|明晚|今天|今晚|今早)/g,
      date: (m) => day({ 大後天: 3, 後天: 2, 明天: 1, 明早: 1, 明晚: 1 }[m[1]] ?? 0),
    },
    // 2026/10/12、2026-10-12、2026年10月12日
    {
      re: /(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})\s*[日號号]?/g,
      date: (m) => {
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        return valid(y, mo, d) ? { y, m: mo, d } : null;
      },
    },
    { re: /(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g, date: (m) => md(Number(m[1]), Number(m[2])) },
    { re: new RegExp(`(${NUM})\\s*月\\s*(${NUM})\\s*[日號号]?`, 'g'), date: (m) => md(toNumber(m[1]), toNumber(m[2])) },
    // 下週三、這禮拜六、星期五（沒說哪週：今天或之後最近的那天）
    {
      re: /(下下|下|這|本)?\s*(?:週|周|星期|禮拜|拜)\s*([一二三四五六日天])/g,
      date: (m) => {
        const target = WEEK[m[2]];
        const dow = new Date(today).getDay();
        // 一週從星期一開始算，「這週日」是這週最後一天
        const mon = (x: number) => (x + 6) % 7;
        if (m[1] === '下' || m[1] === '下下') return day(7 - mon(dow) + mon(target) + (m[1] === '下下' ? 7 : 0));
        if (m[1]) return day(mon(target) - mon(dow));
        return day((target - dow + 7) % 7);
      },
    },
    // 只寫「15號」：這個月，已經過了就下個月
    {
      re: new RegExp(`(?<![月/\\d])(${NUM})\\s*[號号]`, 'g'),
      date: (m) => {
        const d = toNumber(m[1]);
        const t = new Date(now);
        for (const offset of [0, 1]) {
          const mo = t.getMonth() + 1 + offset;
          const y = mo > 12 ? t.getFullYear() + 1 : t.getFullYear();
          const mm = mo > 12 ? mo - 12 : mo;
          if (valid(y, mm, d) && new Date(y, mm - 1, d).getTime() >= today) return { y, m: mm, d };
        }
        return null;
      },
    },
    // 14:00、下午 3:30、3:30pm
    {
      re: new RegExp(`${PERIOD}(\\d{1,2})\\s*[:：]\\s*(\\d{2})\\s*(am|pm|AM|PM)?`, 'g'),
      time: (m) => {
        const h = withPeriod(Number(m[2]), m[1] ?? m[4]);
        const min = Number(m[3]);
        return h < 24 && min < 60 ? { h, min, loose: !(m[1] ?? m[4]) && h >= 1 && h <= 12 } : null;
      },
    },
    // 下午3點、晚上七點半、3點15分、10點（「點心」「點點」不是時間）
    {
      re: new RegExp(`${PERIOD}(${NUM})\\s*[點点時](?![心點点])\\s*(半|(${NUM})\\s*分?)?`, 'g'),
      time: (m) => {
        const raw = toNumber(m[2]);
        const min = m[3] === '半' ? 30 : m[4] ? toNumber(m[4]) : 0;
        // 「快一點」「一點點」不是時間：沒說早晚、也沒寫幾分的「一點」不算
        if (m[2] === '一' && !m[1] && !m[3]) return null;
        if (!(raw >= 0 && raw <= 24 && min >= 0 && min < 60)) return null;
        // 沒說上午下午：1～6 點多半是下午
        const h = m[1] ? withPeriod(raw, m[1]) : raw >= 1 && raw <= 6 ? raw + 12 : raw;
        return h < 24 ? { h, min, loose: !m[1] && raw >= 1 && raw <= 12 } : null;
      },
    },
    {
      re: /(中午|晚上|今晚|明晚|晚間|下午|早上|上午|明早|今早)/g,
      time: (m) =>
        /中午/.test(m[1])
          ? { h: 12, min: 0 }
          : /晚/.test(m[1])
            ? { h: 19, min: 0 }
            : /下午/.test(m[1])
              ? { h: 14, min: 0 }
              : { h: 9, min: 0 },
      weak: true,
    },
  ];

  const tokens: Token[] = [];
  for (const rule of rules) {
    for (const m of text.matchAll(rule.re)) {
      const date = rule.date?.(m) ?? undefined;
      const time = rule.time?.(m) ?? undefined;
      if (!date && !time) continue;
      const start = m.index ?? 0;
      tokens.push({ start, end: start + m[0].length, date, time, weak: rule.weak });
    }
  }
  // 同一段字被兩種寫法認到（例如「晚上7點」裡的「晚上」）：留長的那個
  const kind = (t: Token) => (t.date ? 'd' : 't');
  const overlaps = (a: Token, b: Token) => a.start < b.end && b.start < a.end;
  return tokens
    .filter((t) => !tokens.some((o) => o !== t && kind(o) === kind(t) && overlaps(o, t) && o.end - o.start > t.end - t.start))
    .sort((a, b) => a.start - b.start || b.end - a.end);
}

/** 挨在一起的日期、時間是同一個時間點（同一個時間點最多一個日期、一個時間） */
function moments(text: string, tokens: Token[]) {
  const out: (Moment & { start: number; end: number })[] = [];
  for (const t of tokens) {
    const last = out.at(-1);
    const near = last && (t.start <= last.end || SAME_GAP.test(text.slice(last.end, t.start)));
    if (last && near && !(t.date && last.date) && !(t.time && last.time)) {
      last.date ??= t.date;
      last.time ??= t.time;
      last.end = Math.max(last.end, t.end);
    } else out.push({ start: t.start, end: t.end, date: t.date, time: t.time });
  }
  return out;
}

export function parseWhen(text: string, now: number): FoundWhen | null {
  const tokens = scan(text, now);
  if (!tokens.length) return null;
  const ms = moments(text, tokens);
  // 一段時間：兩個時間點中間只有「~ 到 至」
  for (let i = 0; i + 1 < ms.length; i++) {
    if (RANGE_GAP.test(text.slice(ms[i].end, ms[i + 1].start))) {
      return { date: ms[i].date, time: ms[i].time, end: { date: ms[i + 1].date, time: ms[i + 1].time } };
    }
  }
  // 不是一段時間：第一個出現的日期 ＋ 第一個出現的時間（有寫幾點的優先）
  const date = tokens.find((t) => t.date)?.date;
  const time = (tokens.find((t) => t.time && !t.weak) ?? tokens.find((t) => t.time))?.time;
  return { date, time };
}

/** 認出來的開始時間套到原本的時間上：沒認出的部分照原本的（原本沒有就用 fallback） */
export function applyWhen(found: FoundWhen, current: number | null, fallback: number): number {
  const d = new Date(current ?? fallback);
  if (found.date) d.setFullYear(found.date.y, found.date.m - 1, found.date.d);
  if (found.time) d.setHours(found.time.h, found.time.min, 0, 0);
  return d.getTime();
}

/**
 * 結束時間：沒寫日期就是開始那天、沒寫時間就跟開始同一個時間；
 * 只寫鐘點沒寫早晚（「晚上七點半到十點半」「晚上10點到1點」）：開始之後最近的那個鐘點（可能是隔天凌晨）；
 * 星期幾比開始早就是下一週那天。沒寫結束 → null
 */
export function applyEnd(found: FoundWhen, start: number): number | null {
  const end = found.end;
  if (!end) return null;
  const d = new Date(start);
  if (end.date) d.setFullYear(end.date.y, end.date.m - 1, end.date.d);
  if (end.time && end.time.loose && !end.date) {
    // 兩種可能（上午 / 下午）× 今天 / 明天，挑開始之後最早的
    const base = end.time.h % 12;
    for (const add of [0, 1]) {
      for (const h of [base, base + 12]) {
        const c = new Date(start);
        c.setDate(c.getDate() + add);
        c.setHours(h, end.time.min, 0, 0);
        if (c.getTime() > start) return c.getTime();
      }
    }
  }
  if (end.time) d.setHours(end.time.h, end.time.min, 0, 0);
  let t = d.getTime();
  if (t <= start) t += end.date ? 7 * DAY : DAY;
  return t > start ? t : null;
}
