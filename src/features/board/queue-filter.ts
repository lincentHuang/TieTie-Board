import { STATUS_META, STATUSES, tagColor, tagsInUse, type BoardItem } from '@/lib/types';

/** 排隊時怎麼分隊 */
export type QueueGroup = 'none' | 'status' | 'kind' | 'tag';

export const GROUP_OPTIONS: { value: QueueGroup; label: string; hint: string }[] = [
  { value: 'none', label: '不分隊', hint: '全部排成一隊' },
  { value: 'status', label: '依狀態', hint: '待辦、進行中、完成各排一隊' },
  { value: 'kind', label: '依類型', hint: '緊急、重要、活動、便利貼…各排一隊' },
  { value: 'tag', label: '依標籤', hint: '有好幾個標籤的，排在第一個標籤那隊' },
];

export type Kind = 'urgent' | 'important' | 'event' | 'note' | 'image' | 'sticker';

export const KIND_META: Record<Kind, { label: string; icon: string; color: string }> = {
  urgent: { label: '緊急', icon: '⚠️', color: '#FF5A6E' },
  important: { label: '重要', icon: '📢', color: '#FF9F43' },
  event: { label: '活動', icon: '📅', color: '#3CC49A' },
  note: { label: '便利貼', icon: '📝', color: '#E0A800' },
  image: { label: '照片', icon: '🖼️', color: '#5B9BEF' },
  sticker: { label: '貼圖', icon: '😊', color: '#9B7BFF' },
};
const KINDS = Object.keys(KIND_META) as Kind[];

/** 每個項目只屬於一種類型：公告 > 貼圖 > 還沒到的活動 > 照片 / 便利貼 */
export function kindOf(item: BoardItem, now: number): Kind {
  if (item.priority !== 'none') return item.priority;
  if (item.type === 'sticker') return 'sticker';
  if (item.dueAt !== null && item.dueAt > now) return 'event';
  return item.type === 'image' ? 'image' : 'note';
}

/**
 * 篩選條件：一串 key，例如 ['mine', 'status:todo', 'tag:家事']
 * 同一種（例如兩個標籤）是「或」，不同種之間是「而且」
 */
export type Filter = string[];

interface Ctx {
  now: number;
  /** 等我按「我知道了」 */
  isPending: (item: BoardItem) => boolean;
}

const facetOf = (key: string) => key.split(':')[0];

function hasKey(item: BoardItem, key: string, ctx: Ctx) {
  const [facet, value] = [facetOf(key), key.slice(key.indexOf(':') + 1)];
  if (facet === 'mine') return ctx.isPending(item);
  if (facet === 'kind') return kindOf(item, ctx.now) === value;
  if (facet === 'status') return item.status === value;
  if (facet === 'tag') return item.tags.includes(value);
  return true;
}

export function matchesFilter(item: BoardItem, filter: Filter, ctx: Ctx) {
  const byFacet = new Map<string, string[]>();
  for (const key of filter) byFacet.set(facetOf(key), [...(byFacet.get(facetOf(key)) ?? []), key]);
  return [...byFacet.values()].every((keys) => keys.some((key) => hasKey(item, key, ctx)));
}

export interface Chip {
  key: string;
  label: string;
  color: string;
  count: number;
}

/** 狀態列上的小膠囊：每種各有幾則（沒有的就不顯示，除非正在用它篩選） */
export function filterChips(items: BoardItem[], filter: Filter, ctx: Ctx): Chip[] {
  const count = (key: string) => items.filter((i) => hasKey(i, key, ctx)).length;
  const chips: Chip[] = [
    { key: 'mine', label: '🔔 等我確認', color: '#FF6FA3', count: count('mine') },
    ...KINDS.map((k) => ({ key: `kind:${k}`, label: `${KIND_META[k].icon} ${KIND_META[k].label}`, color: KIND_META[k].color, count: count(`kind:${k}`) })),
    ...STATUSES.filter((st) => st !== 'none').map((st) => ({
      key: `status:${st}`,
      label: `${STATUS_META[st].icon} ${STATUS_META[st].label}`,
      color: STATUS_META[st].color,
      count: count(`status:${st}`),
    })),
    ...tagsInUse(items).map(({ tag, count: n }) => ({ key: `tag:${tag}`, label: `#${tag}`, color: tagColor(tag), count: n })),
  ];
  // 正在篩選、但已經沒有項目的標籤（例如剛被刪掉）也要留著，才能取消
  for (const key of filter) {
    if (!chips.some((c) => c.key === key) && key.startsWith('tag:')) {
      const tag = key.slice(4);
      chips.push({ key, label: `#${tag}`, color: tagColor(tag), count: 0 });
    }
  }
  return chips.filter((c) => c.count > 0 || filter.includes(c.key));
}

export interface QueueSection {
  key: string;
  /** 隊伍前面的小牌子；不分隊時是空的 */
  label: string;
  color: string;
  items: BoardItem[];
}

/** 把排好順序的項目分成好幾隊（每一隊裡面維持原本的順序） */
export function groupQueue(ordered: BoardItem[], group: QueueGroup, now: number): QueueSection[] {
  if (group === 'none') return [{ key: 'all', label: '', color: '', items: ordered }];

  const sections: QueueSection[] = [];
  const add = (key: string, label: string, color: string, items: BoardItem[]) => {
    if (items.length) sections.push({ key, label, color, items });
  };

  if (group === 'status') {
    for (const st of ['todo', 'doing', 'done', 'none'] as const) {
      const m = STATUS_META[st];
      add(`status:${st}`, st === 'none' ? m.label : `${m.icon} ${m.label}`, m.color, ordered.filter((i) => i.status === st));
    }
  } else if (group === 'kind') {
    for (const k of KINDS) {
      const m = KIND_META[k];
      add(`kind:${k}`, `${m.icon} ${m.label}`, m.color, ordered.filter((i) => kindOf(i, now) === k));
    }
  } else {
    for (const { tag } of tagsInUse(ordered)) {
      add(`tag:${tag}`, `#${tag}`, tagColor(tag), ordered.filter((i) => i.tags[0] === tag));
    }
    add('tag:', '沒有標籤', STATUS_META.none.color, ordered.filter((i) => i.tags.length === 0));
  }
  return sections;
}
