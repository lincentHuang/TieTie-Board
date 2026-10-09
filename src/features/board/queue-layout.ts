import type { BoardItem, Geometry } from '@/lib/types';

import type { QueueSection } from './queue-order';

/** 同一排左右的間隔 */
const GAP = 16;
/** 排跟排之間：只留地板的位置（走路時身體是被腳撐高，不用另外留腳的空間），畫面才放得下多一點 */
const ROW_GAP = 30;
/** 地板在這一排底部下面多遠 */
const FLOOR_DROP = 10;
/** 每一段前面的小牌子要佔多高 */
const SIGN_SPACE = 48;
/** 段跟段之間多空一點 */
const SECTION_GAP = 8;

export interface QueueLayout {
  spots: Map<string, Geometry>;
  /** 每一排腳下的地板 */
  floors: { key: string; x: number; y: number; w: number; color: string }[];
  /** 每一段前面的小牌子 */
  signs: { key: string; label: string; color: string; count: number; x: number; y: number }[];
  /** 最長那一排的寬度 */
  width: number;
  /** 最後一排地板的底部（沒有人排隊時是 0） */
  height: number;
}

/** 照順序從左到右排，超過 rowWidth 就換下一排 */
function wrap(items: BoardItem[], rowWidth: number) {
  const rows: BoardItem[][] = [];
  let row: BoardItem[] = [];
  let used = 0;
  for (const item of items) {
    const need = row.length ? used + GAP + item.w : item.w;
    if (row.length && need > rowWidth) {
      rows.push(row);
      row = [item];
      used = item.w;
    } else {
      row.push(item);
      used = need;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

/**
 * 排隊模式：每一段（日期）從新的一排開始，前面插一支小牌子。
 * 同一排底部對齊，看起來像大家站在同一條地板上排隊。卡片大小由外面決定（排隊時會精簡成剛好裝下內容）。
 */
export function queueLayout(sections: QueueSection[], rowWidth: number): QueueLayout {
  const spots = new Map<string, Geometry>();
  const floors: QueueLayout['floors'] = [];
  const signs: QueueLayout['signs'] = [];
  let width = 0;
  let top = 0;
  let height = 0;
  sections.forEach((section, si) => {
    if (si > 0) top += SECTION_GAP;
    if (section.label) {
      signs.push({ key: section.key, label: section.label, color: section.color, count: section.items.length, x: 0, y: top });
      top += SIGN_SPACE;
    }
    wrap(section.items, rowWidth).forEach((row, ri) => {
      const rowH = Math.max(...row.map((i) => i.h));
      let left = 0;
      for (const item of row) {
        spots.set(item.id, { x: left, y: top + rowH - item.h, w: item.w, h: item.h });
        left += item.w + GAP;
      }
      const rowW = left - GAP;
      width = Math.max(width, rowW);
      floors.push({ key: `${section.key}#${ri}`, x: -16, y: top + rowH + FLOOR_DROP, w: rowW + 32, color: section.color });
      height = top + rowH + FLOOR_DROP + 6;
      top += rowH + ROW_GAP;
    });
  });
  return { spots, floors, signs, width, height };
}
