import { isAnnouncement, type BoardItem, type Geometry } from '@/lib/types';

/**
 * 白板上的小動作（只在自己的畫面上，不會存起來）：
 * - 沒看的公告慢慢走向畫面中間，擋路的卡片被擠到旁邊；看過了就走回原位，被擠開的也會走回去
 * - 沒看的公告一陣子就緊張地跺腳，越緊急越常跺
 */

export type Point = { x: number; y: number };

/**
 * 要站的位置變了的時候怎麼過去：
 * walk = 長腳走過去（切換模式、隊伍重排、別人移動了它、走回原位）；
 * stroll = 慢慢走（沒看的公告走向畫面中間）；shove = 被擠開，直接滑過去
 */
export type Move = 'walk' | 'stroll' | 'shove';

/** 有多緊張：0 = 不會；1 = 偶爾跺腳（重要公告）；2 = 常常跺腳（緊急、或活動快到了） */
export type Nervous = 0 | 1 | 2;

/** 活動在這段時間內就要到了，也算很緊急 */
const SOON = 3 * 3_600_000;

/** 我還沒看的公告有多緊張 */
export function nervousness(item: BoardItem, pending: boolean, now: number): Nervous {
  if (!pending || !isAnnouncement(item)) return 0;
  const soon = item.dueAt !== null && item.dueAt > now && item.dueAt - now < SOON;
  return item.priority === 'urgent' || soon ? 2 : 1;
}

/** 從 from 往 to 最多走 step；已經到了回傳 null */
export function stepToward(from: Point, to: Point, step: number): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;
  const k = Math.min(1, step / dist);
  return { x: from.x + dx * k, y: from.y + dy * k };
}

/** a 要移動多少才不會跟 b 重疊：往重疊比較少的方向、離開 b，再多留 gap；沒重疊回傳 null */
export function pushOut(a: Geometry, b: Geometry, gap: number): Point | null {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ox <= 0 || oy <= 0) return null;
  if (ox < oy) return { x: (a.x + a.w / 2 >= b.x + b.w / 2 ? 1 : -1) * (ox + gap), y: 0 };
  return { x: 0, y: (a.y + a.h / 2 >= b.y + b.h / 2 ? 1 : -1) * (oy + gap) };
}

/** 一直推到不跟任何一個 obstacles 重疊（最多推幾輪，夾在中間時不會推不完） */
export function clearOf(r: Geometry, obstacles: Geometry[], gap: number): Point {
  let pos = { x: r.x, y: r.y };
  for (let round = 0; round < 6; round++) {
    let moved = false;
    for (const o of obstacles) {
      const d = pushOut({ ...r, ...pos }, o, gap);
      if (d) {
        pos = { x: pos.x + d.x, y: pos.y + d.y };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return pos;
}

/**
 * 走過來的公告擋到誰，誰就被擠到旁邊。只看大家原本的位置：公告走過去之後，被擠開的就會走回原位。
 * 回傳被擠開的卡片要站在哪
 */
export function shoveAside(walkers: Geometry[], others: (Geometry & { id: string })[], gap = 14) {
  const out = new Map<string, Point>();
  if (!walkers.length) return out;
  for (const o of others) {
    const pos = clearOf(o, walkers, gap);
    if (pos.x !== o.x || pos.y !== o.y) out.set(o.id, pos);
  }
  return out;
}

export interface Walker {
  id: string;
  /** 現在站的位置 */
  at: Geometry;
  /** 這次不走（被選起來了、剛被放下來休息中） */
  frozen: boolean;
}

/**
 * 沒看的公告往畫面中間走一小段（walkers 照誰先走排好，通常是越緊急越前面）。
 * 後面的碰到前面的就停在旁邊，不會疊成一團。回傳每一個要站的位置
 */
export function strollStep(walkers: Walker[], center: Point, step: number, gap = 14) {
  const placed: Geometry[] = [];
  const next = new Map<string, Point>();
  for (const wk of walkers) {
    let pos: Point = { x: wk.at.x, y: wk.at.y };
    if (!wk.frozen) {
      pos = stepToward(pos, { x: center.x - wk.at.w / 2, y: center.y - wk.at.h / 2 }, step) ?? pos;
      pos = clearOf({ ...wk.at, ...pos }, placed, gap);
    }
    placed.push({ ...wk.at, ...pos });
    next.set(wk.id, pos);
  }
  return next;
}
