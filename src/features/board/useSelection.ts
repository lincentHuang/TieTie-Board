import { useState } from 'react';

/**
 * 白板上選了哪些項目。
 * multi = 長按進入的多選模式：點一下是加入 / 拿掉，拖其中一個會整批一起移動
 */
export interface Selection {
  ids: string[];
  multi: boolean;
}

const NONE: Selection = { ids: [], multi: false };

/** 點一下項目：平常是只選這一個；多選時是加入 / 拿掉，全部拿掉就離開多選 */
export const tapItem = (sel: Selection, id: string): Selection => {
  if (!sel.multi) return { ids: [id], multi: false };
  return sel.ids.includes(id) ? without(sel, [id]) : { ids: [...sel.ids, id], multi: true };
};

/** 長按：進入多選，原本選的那一個也留著 */
export const longPressItem = (sel: Selection, id: string): Selection => ({
  ids: sel.ids.includes(id) ? sel.ids : [...sel.ids, id],
  multi: true,
});

/** 拿掉某些項目（被篩選藏起來了）；都拿光了就回到沒有選取 */
export const without = (sel: Selection, ids: string[]): Selection => {
  const rest = sel.ids.filter((x) => !ids.includes(x));
  return rest.length ? { ids: rest, multi: sel.multi } : NONE;
};

export function useSelection() {
  const [sel, setSel] = useState<Selection>(NONE);
  return {
    ...sel,
    tap: (id: string) => setSel((cur) => tapItem(cur, id)),
    longPress: (id: string) => setSel((cur) => longPressItem(cur, id)),
    /** 只選這一個（例如從公告清單「在白板上找」） */
    only: (id: string) => setSel({ ids: [id], multi: false }),
    selectAll: (ids: string[]) => setSel(ids.length ? { ids, multi: true } : NONE),
    clear: () => setSel(NONE),
  };
}
