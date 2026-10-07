/**
 * 便利貼內容的簡單格式（還是存成一般文字，舊版 App 也看得懂）：
 *   # 開頭的行      → 標題（有標題就用它當小工具、通知上的名稱）
 *   **重點**        → 重點字（螢光筆）
 *   [文字](網址)    → 連結；直接貼 https:// 或 www. 開頭的網址也會變連結
 */

export interface RichSpan {
  text: string;
  bold: boolean;
  /** 只接受 http(s)，其他（javascript: 之類）一律當一般文字 */
  url?: string;
}

export interface RichLine {
  heading: boolean;
  spans: RichSpan[];
}

const HEADING = /^#\s+/;
/** [文字](網址)、**重點**、網址 */
const TOKEN = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+?)\*\*|((?:https?:\/\/|www\.)[^\s<>()[\]]+[^\s<>()[\].,;:!?，。、；：！？」』）])/gi;

/** 網址只接受 http(s)；www. 開頭的補上 https:// */
export const safeUrl = (raw: string): string | undefined => {
  const url = /^www\./i.test(raw) ? `https://${raw}` : raw;
  return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(url) ? url : undefined;
};

function parseSpans(line: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let at = 0;
  for (const m of line.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > at) spans.push({ text: line.slice(at, start), bold: false });
    if (m[1] !== undefined) {
      const url = safeUrl(m[2]);
      spans.push(url ? { text: m[1], bold: false, url } : { text: m[0], bold: false });
    } else if (m[3] !== undefined) {
      spans.push({ text: m[3], bold: true });
    } else {
      spans.push({ text: m[4], bold: false, url: safeUrl(m[4]) });
    }
    at = start + m[0].length;
  }
  if (at < line.length) spans.push({ text: line.slice(at), bold: false });
  return spans;
}

export function parseRichText(text: string): RichLine[] {
  return text.split('\n').map((line) => {
    const heading = HEADING.test(line);
    return { heading, spans: parseSpans(heading ? line.replace(HEADING, '') : line) };
  });
}

/** 拿掉格式記號，給通知、小工具這些只能放純文字的地方 */
export const plainLine = (line: string) =>
  parseSpans(line.replace(HEADING, ''))
    .map((s) => s.text)
    .join('');

export const plainText = (text: string) => text.split('\n').map(plainLine).join('\n');

/** 標題：有標成標題的行就用第一個，沒有就用第一行 */
export function richTitle(text: string) {
  const lines = text.split('\n');
  const heading = lines.find((l) => HEADING.test(l));
  return plainLine(heading ?? lines[0] ?? '').trim();
}

export const hasFormatting = (text: string) =>
  parseRichText(text).some((l) => l.heading || l.spans.some((s) => s.bold || s.url));

/** 編輯器用：選取範圍 [start, end) */
export interface Selection {
  start: number;
  end: number;
}

/** 選到的那幾行切換成標題 / 一般行 */
export function toggleHeading(text: string, sel: Selection): { text: string; sel: Selection } {
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  const nl = text.indexOf('\n', Math.max(sel.end - (sel.end > sel.start ? 1 : 0), sel.start));
  const lineEnd = nl === -1 ? text.length : nl;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const allHeading = lines.every((l) => HEADING.test(l) || !l.trim());
  const next = lines.map((l) => (allHeading ? l.replace(HEADING, '') : !l.trim() || HEADING.test(l) ? l : `# ${l}`)).join('\n');
  const delta = next.length - (lineEnd - lineStart);
  return {
    text: text.slice(0, lineStart) + next + text.slice(lineEnd),
    sel: { start: lineStart, end: lineEnd + delta },
  };
}

/** 選到的字前後包上記號；已經包著就拿掉。沒選字就放一組空記號，游標停在中間 */
export function wrapSelection(text: string, sel: Selection, before: string, after: string, placeholder = '') {
  const picked = text.slice(sel.start, sel.end);
  if (text.slice(sel.start - before.length, sel.start) === before && text.slice(sel.end, sel.end + after.length) === after) {
    return {
      text: text.slice(0, sel.start - before.length) + picked + text.slice(sel.end + after.length),
      sel: { start: sel.start - before.length, end: sel.end - before.length },
    };
  }
  const inner = picked || placeholder;
  const start = sel.start + before.length;
  return {
    text: text.slice(0, sel.start) + before + inner + after + text.slice(sel.end),
    sel: { start, end: start + inner.length },
  };
}

/** 選到的字變成連結（沒選字就直接放網址） */
export function insertLink(text: string, sel: Selection, url: string) {
  const picked = text.slice(sel.start, sel.end).replace(/\n/g, ' ').trim();
  const piece = picked ? `[${picked}](${url})` : url;
  const end = sel.start + piece.length;
  return { text: text.slice(0, sel.start) + piece + text.slice(sel.end), sel: { start: end, end } };
}
