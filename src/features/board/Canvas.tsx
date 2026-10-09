import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { C, F, Ionicons, themed } from '@/components/ui';
import { useBlockPullToClose } from '@/components/useBlockPullToClose';
import { byQueueOrder, isItemDone, type BoardItem, type Geometry } from '@/lib/types';

import { CanvasItem, type GroupDrag, type Hit } from './CanvasItem';
import { ModeBar } from './ModeBar';
import { queueLayout } from './queue-layout';
import { queuePages } from './queue-order';
import { QueueTabs } from './QueueTabs';
import type { ViewMode } from './useViewPrefs';
import { nervousness, shoveAside, strollStep, type Move, type Point } from './wander';

const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const GRID = 32;
/** 排隊模式：隊伍左右留白、上面留給模式按鈕和分頁、下面留給工具列 */
const QUEUE_PAD = 16;
const QUEUE_TOP = 64;
/** 排隊時精簡的卡片：最矮多高、最多長到原本的幾倍（字太多時多露一點） */
const FIT_MIN_H = 84;
const FIT_MAX_GROW = 1.5;
/** 一排放不下兩張的窄畫面（手機）：卡片拉到跟畫面一樣寬，字少換行、卡片更矮 */
const STRETCH_BELOW = 520;
/** 拉寬的卡片最寬多寬 */
const STRETCH_MAX = 480;
const QUEUE_BOTTOM = 170;
/** 隊伍最後面的「新增」卡片 */
const ADD_GAP = 30;
const ADD_H = 110;
/** 左右滑超過畫面寬的幾成、或滑得夠快，就換頁 */
const PAGE_FLIP = 0.2;
const PAGE_FLING = 500;
/** 沒看的公告多久往畫面中間走一小段、一段走多遠（螢幕像素）；被手指放下之後休息幾趟再走（約 15 秒） */
const STROLL_EVERY = 3200;
const STROLL_STEP = 110;
const STROLL_REST = 5;
/** 畫面中間要扣掉下面的工具列，看起來才是正中間 */
const CENTER_LIFT = 20;

/**
 * 用手指操作（手機、平板）：項目要先點一下選起來才能拖，免得想滑動畫面時不小心拖走；
 * 用滑鼠的電腦直接拖就好
 */
const TOUCH =
  Platform.OS !== 'web' || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);

export interface CanvasHandle {
  /** 目前畫面中心在白板上的座標 */
  viewCenter: () => { x: number; y: number };
  /** 把鏡頭移到這個項目；排隊時會先換到它那一頁 */
  focus: (id: string) => void;
  fitAll: () => void;
  /** 現在白板上看得到的項目（排隊時是目前這一頁），多選「全選」用 */
  visibleIds: () => string[];
}

interface Props {
  ref?: Ref<CanvasHandle>;
  items: BoardItem[];
  now: number;
  /** true = 排隊模式（只影響自己的畫面），false = 自由擺放（位置大家同步） */
  queued: boolean;
  onChangeMode: (mode: ViewMode) => void;
  selectedIds: string[];
  /** 長按進入的多選模式 */
  multi: boolean;
  isPending: (item: BoardItem) => boolean;
  readCount: (item: BoardItem) => number;
  memberCount: number;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  /** 點了空白的地方、換了一頁 */
  onClear: () => void;
  onOpen: (id: string) => void;
  /** 放大後直接點卡片上的一項待辦 */
  onToggleTask: (id: string, taskId: string) => void;
  onCommit: (id: string, geo: Geometry) => void;
  /** 多選時整批一起拖完：每個選取的項目移到哪 */
  onCommitGroup: (moves: { id: string; x: number; y: number }[]) => void;
  /** 排隊時最後面的「新增」卡片：true = 公告那頁 */
  onAdd: (announcement: boolean) => void;
}

export function Canvas({
  ref,
  items,
  now,
  queued,
  onChangeMode,
  selectedIds,
  multi,
  isPending,
  readCount,
  memberCount,
  onTap,
  onLongPress,
  onClear,
  onOpen,
  onToggleTask,
  onCommit,
  onCommitGroup,
  onAdd,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  // 手勢只記「上一格」，每一格只加上這一格的變化：兩根手指沒有同時放開、中途多放一根手指，畫面都不會跳
  const panLast = useSharedValue({ x: 0, y: 0, n: 0 });
  const pinchLast = useSharedValue({ s: 1, n: 0 });
  // 網頁版的 Gesture Handler 給的縮放中心是整個頁面的座標（手機是畫布裡的座標），要扣掉畫布在頁面上的位置
  const pageOffset = useSharedValue({ x: 0, y: 0 });
  // 正在拖曳 / 縮放白板上的項目時，畫布本身不要跟著移動
  const itemBusy = useSharedValue(false);
  const ignorePan = useSharedValue(false);
  // 多選時整批一起拖：大家都照著同一個位移走
  const groupDrag = useSharedValue<GroupDrag>({ on: false, dx: 0, dy: 0 });
  // 正在被拖的項目：快速撞到的會被推開；慢慢碰到的會被跨過去（stepOver = 正被跨著幾張）
  const hit = useSharedValue<Hit>({ on: false, id: '', x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0 });
  const stepOver = useSharedValue(0);
  const reduced = useReducedMotion();
  /** 沒看的公告走到哪了（只在自己的畫面上，不會存起來；看過就走回原位） */
  const [wander, setWander] = useState<Record<string, Point>>({});
  /** 被手指放下的公告還要休息幾趟才繼續走 */
  const resting = useRef<Record<string, number>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<View>(null);
  const didInitialFit = useRef(false);
  const wasQueued = useRef(queued);
  const lastWidth = useRef(0);

  // 排隊：公告一頁、記事一頁並排（左右滑切換），每頁依日期一段一段站好，一排的寬度剛好是畫面寬
  const [page, setPage] = useState(0);
  /** 每一頁捲到哪（換頁回來時接著看） */
  const scrollOf = useSharedValue<number[]>([]);
  // 手勢裡要用：這次是左右滑（1）還是上下捲（2），以及開始時的位置
  const axis = useSharedValue(0);
  const panFrom = useSharedValue({ x: 0, y: 0 });
  const wheelX = useRef({ sum: 0, until: 0 });
  // 排隊時精簡空間：便利貼高度剛好裝下內容；手機上拉成跟畫面一樣寬（照片、貼圖維持原本大小）
  const [fitH, setFitH] = useState<Record<string, number>>({});
  const reportFit = (id: string, height: number) =>
    setFitH((cur) => (Math.abs((cur[id] ?? -99) - height) < 3 ? cur : { ...cur, [id]: height }));
  const room = size.w - QUEUE_PAD * 2;
  const stretch = room > 0 && room < STRETCH_BELOW;
  const sized = items.map((i) => {
    if (i.type !== 'note') return i;
    const w = stretch ? Math.min(STRETCH_MAX, room) : i.w;
    const fit = fitH[i.id];
    const h = fit ? Math.round(Math.min(i.h * FIT_MAX_GROW, Math.max(FIT_MIN_H, fit))) : i.h;
    return { ...i, w, h };
  });
  // 完成的（狀態完成、或待辦全勾完）收進封存：平常不排隊，按右上角 📦 才看得到，把狀態改回來就回到隊伍
  const [archive, setArchive] = useState(false);
  /** 換到封存 / 隊伍之後要對準的項目 */
  const focusAfter = useRef<string | null>(null);
  const archivedCount = items.filter(isItemDone).length;
  const pages = queuePages(queued ? sized.filter((i) => isItemDone(i) === archive) : items, now);
  const widest = Math.max(0, ...pages.flatMap((p) => p.items.map((i) => i.w)));
  const lanes = pages.map((p) => queueLayout(p.sections, Math.max(widest, size.w - QUEUE_PAD * 2)));
  /** 排隊時固定的縮放：有比畫面寬的卡片才縮小，不給放大縮小 */
  const fit = size.w ? Math.min(1, (size.w - QUEUE_PAD * 2) / Math.max(1, ...lanes.map((l) => l.width))) : 1;
  /** 一頁在白板上多寬：剛好是畫面寬 */
  const pageW = size.w / fit;
  const laneX = (p: number) => p * pageW + (pageW - lanes[p].width) / 2;
  const queueSpots = new Map<string, Geometry>();
  const pageOf = new Map<string, number>();
  lanes.forEach((lane, p) =>
    lane.spots.forEach((g, id) => {
      queueSpots.set(id, { ...g, x: g.x + laneX(p) });
      pageOf.set(id, p);
    }),
  );
  const addW = (p: number) => Math.max(lanes[p].width, Math.min(320, pageW - QUEUE_PAD * 2));
  const addSpot = (p: number) => ({
    x: p * pageW + (pageW - addW(p)) / 2,
    y: lanes[p].height + (lanes[p].height ? ADD_GAP : 0),
    w: addW(p),
  });
  /** 上下捲的範圍：最上面是隊伍開頭，最下面是「新增」卡片剛好在工具列上面 */
  const topY = QUEUE_TOP;
  const bottomY = (p: number) =>
    Math.min(topY, size.h - QUEUE_BOTTOM - (addSpot(p).y + ADD_H) * fit);
  const clampY = (p: number, y: number) => Math.min(topY, Math.max(bottomY(p), y));

  // 自由擺放時：沒看的公告走向畫面中間，擋路的卡片被擠開（減少動態效果時不走）
  const strolling = !queued && !reduced;
  const walkers = strolling ? items.filter((i) => isPending(i) && wander[i.id]) : [];
  const shoved = shoveAside(
    walkers.map((i) => ({ ...geometryOf(i), ...wander[i.id] })),
    items.filter((i) => !walkers.includes(i)),
  );
  const spotOf = (item: BoardItem): Geometry => {
    if (queued) return queueSpots.get(item.id) ?? geometryOf(item);
    const at = (walkers.includes(item) ? wander[item.id] : undefined) ?? shoved.get(item.id);
    return at ? { ...geometryOf(item), ...at } : geometryOf(item);
  };
  const moveOf = (item: BoardItem): Move =>
    queued ? 'walk' : walkers.includes(item) ? 'stroll' : shoved.has(item.id) ? 'shove' : 'walk';
  // 每一頁一個接一個出發，整隊最多等 1.2 秒
  const walkStep = Math.min(90, 1200 / Math.max(1, ...pages.map((p) => p.items.length)));
  const orderOf = new Map(
    pages.flatMap((p) => p.sections.flatMap((sec) => sec.items).map((item, i) => [item.id, i] as const)),
  );

  /** 沒看的公告往畫面中間走一小段：越緊急的越先走；被選起來、剛被放下的這次不走 */
  const stroll = () => {
    if (!size.w) return;
    const sc = scale.get();
    const center = { x: (size.w / 2 - tx.get()) / sc, y: (size.h / 2 - CENTER_LIFT - ty.get()) / sc };
    const pending = items.filter(isPending).sort(byQueueOrder(now));
    const rest = resting.current;
    for (const id of Object.keys(rest)) if (--rest[id] <= 0) delete rest[id];
    const next = strollStep(
      pending.map((i) => ({
        id: i.id,
        at: { ...geometryOf(i), ...wander[i.id] },
        frozen: selectedIds.includes(i.id) || i.id in rest,
      })),
      center,
      STROLL_STEP / sc,
    );
    const out: Record<string, Point> = {};
    for (const item of pending) {
      const p = next.get(item.id);
      if (!p) continue;
      const prev = wander[item.id];
      // 還在原位、沒有要走的就不記；走不到 2 點的不算（免得一直重新渲染）
      if (!prev && Math.hypot(p.x - item.x, p.y - item.y) < 1) continue;
      out[item.id] = prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 2 ? prev : p;
    }
    const same =
      Object.keys(out).length === Object.keys(wander).length && Object.entries(out).every(([id, p]) => wander[id] === p);
    if (!same) setWander(out);
  };
  // 計時器每次都叫最新的 stroll（拿得到最新的項目、選取、鏡頭位置）
  const strollRef = useRef(stroll);
  useEffect(() => {
    strollRef.current = stroll;
  });
  const anyPending = strolling && items.some(isPending);
  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(() => strollRef.current(), STROLL_EVERY);
    return () => clearInterval(timer);
  }, [anyPending]);

  /** 沒看的公告被手指放到別的地方（或被撞開）：就停在那裡休息一下，不要馬上又走掉 */
  const settle = (moves: { id: string; x: number; y: number }[]) => {
    const placed = moves.filter((m) => items.some((i) => i.id === m.id && isPending(i)));
    for (const m of placed) resting.current[m.id] = STROLL_REST;
    // 已經走出來的：記住新的位置，才不會又走回剛剛的地方
    const walked = placed.filter((m) => wander[m.id]);
    if (walked.length) {
      setWander((cur) => ({ ...cur, ...Object.fromEntries(walked.map((m) => [m.id, { x: m.x, y: m.y }])) }));
    }
  };

  const commit = (id: string, geo: Geometry) => {
    settle([{ id, x: geo.x, y: geo.y }]);
    onCommit(id, geo);
  };

  /** 多選整批拖完：從大家在畫面上站的位置（可能正走在路上、被擠開）一起移動 (dx, dy) */
  const commitGroup = (dx: number, dy: number) => {
    const moves = items
      .filter((i) => selectedIds.includes(i.id))
      .map((i) => {
        const at = spotOf(i);
        return { id: i.id, x: at.x + dx, y: at.y + dy };
      });
    settle(moves);
    onCommitGroup(moves);
  };

  const animateTo = (nx: number, ny: number, ns: number) => {
    const t = { duration: 350 };
    tx.set(withTiming(nx, t));
    ty.set(withTiming(ny, t));
    scale.set(withTiming(ns, t));
  };

  /** 排隊：換到第 p 頁，捲到 y（沒給就回到上次看到的地方） */
  const goPage = (p: number, y?: number) => {
    if (!size.w) return;
    const saved = [...scrollOf.get()];
    saved[page] = ty.get();
    scrollOf.set(saved);
    setPage(p);
    animateTo(-p * size.w, clampY(p, y ?? saved[p] ?? topY), fit);
  };
  /** 使用者自己換頁：選取的東西在另一頁看不到了，先取消 */
  const flipTo = (p: number) => {
    if (p !== page) onClear();
    goPage(p);
  };

  const fitAll = () => {
    if (!size.w || !size.h) return;
    if (queued) return goPage(page, topY);
    if (items.length === 0) return animateTo(size.w / 2 - 150, size.h / 2 - 150, 1);
    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.w));
    const maxY = Math.max(...items.map((i) => i.y + i.h));
    const pad = 40;
    const s = Math.min(
      1.2,
      Math.max(MIN_SCALE, Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2) / (maxY - minY))),
    );
    animateTo(
      (size.w - (maxX - minX) * s) / 2 - minX * s,
      (size.h - (maxY - minY) * s) / 2 - minY * s,
      s,
    );
  };

  useImperativeHandle(ref, () => ({
    // 排隊時沒有固定的白板座標：新項目由外面決定放哪
    viewCenter: () =>
      queued
        ? { x: NaN, y: NaN }
        : { x: (size.w / 2 - tx.get()) / scale.get(), y: (size.h / 2 - ty.get()) / scale.get() },
    focus: (id) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      // 要找的在另一邊（封存 / 隊伍）→ 先換過去，排好之後再對準它
      if (queued && isItemDone(item) !== archive) {
        focusAfter.current = id;
        setArchive(!archive);
        return;
      }
      const g = spotOf(item);
      if (queued) {
        const p = pageOf.get(id) ?? page;
        return goPage(p, size.h / 2 - (g.y + g.h / 2) * fit);
      }
      const s = Math.min(1.5, Math.max(0.6, Math.min(size.w / (g.w * 1.6), size.h / (g.h * 1.6))));
      animateTo(size.w / 2 - (g.x + g.w / 2) * s, size.h / 2 - (g.y + g.h / 2) * s, s);
    },
    fitAll,
    visibleIds: () => (queued ? pages[page].items : items).map((i) => i.id),
  }));


  // 第一次拿到資料時，自動縮放到看得見全部（排隊時站到公告那頁開頭）
  useEffect(() => {
    if (didInitialFit.current || !size.w || (items.length === 0 && !queued)) return;
    didInitialFit.current = true;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, items.length]);

  // 切換自由擺放 / 排隊：鏡頭跟著移到大家要去的地方
  useEffect(() => {
    if (wasQueued.current === queued) return;
    wasQueued.current = queued;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued]);

  // 換到封存 / 隊伍之後：有要找的就對準它，不然回到這頁開頭
  const wasArchive = useRef(archive);
  useEffect(() => {
    if (wasArchive.current === archive) return;
    wasArchive.current = archive;
    const id = focusAfter.current;
    focusAfter.current = null;
    const g = id ? queueSpots.get(id) : undefined;
    if (id && g) goPage(pageOf.get(id) ?? page, size.h / 2 - (g.y + g.h / 2) * fit);
    else goPage(page, topY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive]);
  const toggleArchive = () => {
    onClear();
    setArchive((a) => !a);
  };

  // 排隊時畫面寬度變了（轉向、調整視窗）→ 隊伍會重排，鏡頭對準目前這一頁
  useEffect(() => {
    const prev = lastWidth.current;
    lastWidth.current = size.w;
    if (queued && prev && prev !== size.w) goPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w]);

  // 排隊時隊伍變短了（刪掉、換到另一頁）→ 捲過頭的話拉回來
  const pageBottom = size.w ? bottomY(page) : 0;
  useEffect(() => {
    if (!queued || !size.w) return;
    const y = ty.get();
    if (y < pageBottom) ty.set(withTiming(pageBottom, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageBottom]);

  const zoomAround = (fx: number, fy: number, ns: number) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns));
    tx.set(fx - ((fx - tx.get()) / scale.get()) * s);
    ty.set(fy - ((fy - ty.get()) / scale.get()) * s);
    scale.set(s);
  };

  // 網頁：滾輪平移、Ctrl/⌘ + 滾輪（或觸控板雙指捏合）縮放；排隊時滾輪上下捲、觸控板左右滑換頁
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = containerRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (queued) {
        const w = wheelX.current;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          w.sum += e.deltaX;
          // 觸控板一次左右滑會連續來很多下：換一頁之後先停一下，免得一次翻過頭
          const t = Date.now();
          if (Math.abs(w.sum) > 60 && t > w.until) {
            w.until = t + 600;
            const next = Math.min(pages.length - 1, Math.max(0, page + Math.sign(w.sum)));
            w.sum = 0;
            flipTo(next);
          }
        } else {
          w.sum = 0;
          if (!e.ctrlKey && !e.metaKey) ty.set(clampY(page, ty.get() - e.deltaY));
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        zoomAround(e.clientX - rect.left, e.clientY - rect.top, scale.get() * Math.exp(-e.deltaY * 0.01));
      } else {
        tx.set(tx.get() - e.deltaX);
        ty.set(ty.get() - e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // 網頁：iPhone 的 LINE 瀏覽器往下拖會關掉頁面，在白板上拖曳時擋掉
  useBlockPullToClose(containerRef);

  // 平移和縮放都只套用「這一格跟上一格的差」，不記手勢開始時的位置：
  // 以前兩個手勢各自從開始時的位置重算，一根手指先放開、縮放結束時，平移就用舊的起點把畫面拉回去（跳一下）
  // 排隊：上下捲（放開後還會滑一段）、左右滑換頁；捲過頭會有點彈性，放開再彈回來
  const lastPage = pages.length - 1;
  const flipW = size.w;
  const minY = size.w ? bottomY(page) : 0;
  const pan = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onStart((e) => {
      ignorePan.set(itemBusy.get());
      // 從 0 開始算：手指在啟動前已經移動的那一段也補上，畫面才會一直黏在手指下
      panLast.set({ x: 0, y: 0, n: e.numberOfPointers });
      if (queued) {
        cancelAnimation(tx);
        cancelAnimation(ty);
        axis.set(0);
        panFrom.set({ x: tx.get(), y: ty.get() });
      }
    })
    .onUpdate((e) => {
      if (queued) {
        // 先看手指往哪個方向走得比較多，決定這次是換頁還是捲動（之後就不換）
        if (axis.get() === 0) {
          if (Math.hypot(e.translationX, e.translationY) < 10) return;
          axis.set(Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2);
        }
        const from = panFrom.get();
        if (axis.get() === 1) {
          const edge = (page === 0 && e.translationX > 0) || (page === lastPage && e.translationX < 0);
          tx.set(from.x + e.translationX * (edge ? 0.3 : 1));
        } else {
          let ny = from.y + e.translationY;
          if (ny > topY) ny = topY + (ny - topY) * 0.35;
          if (ny < minY) ny = minY + (ny - minY) * 0.35;
          ty.set(ny);
        }
        return;
      }
      const last = panLast.get();
      panLast.set({ x: e.translationX, y: e.translationY, n: e.numberOfPointers });
      // 手指數量變了：這一格的位移是重心換位置造成的，不是手指在動，不算
      if (ignorePan.get() || e.numberOfPointers !== last.n) return;
      tx.set(tx.get() + e.translationX - last.x);
      ty.set(ty.get() + e.translationY - last.y);
    })
    .onEnd((e) => {
      if (!queued) return;
      if (axis.get() === 1) {
        let next = page;
        if (e.translationX < -flipW * PAGE_FLIP || e.velocityX < -PAGE_FLING) next = Math.min(lastPage, page + 1);
        if (e.translationX > flipW * PAGE_FLIP || e.velocityX > PAGE_FLING) next = Math.max(0, page - 1);
        scheduleOnRN(flipTo, next);
        return;
      }
      const y = ty.get();
      if (y > topY || y < minY) ty.set(withTiming(Math.min(topY, Math.max(minY, y)), { duration: 280 }));
      else ty.set(withDecay({ velocity: e.velocityY, clamp: [minY, topY] }));
    });

  const pinch = Gesture.Pinch()
    .enabled(!queued)
    .onStart((e) => {
      pinchLast.set({ s: e.scale, n: e.numberOfPointers });
    })
    .onUpdate((e) => {
      const last = pinchLast.get();
      pinchLast.set({ s: e.scale, n: e.numberOfPointers });
      // 剩一根手指、或剛多放 / 少一根手指：縮放比例會突然變，這一格不算
      if (e.numberOfPointers < 2 || e.numberOfPointers !== last.n || last.s <= 0) return;
      // 以兩指中間為中心縮放（中間點本身的移動交給平移）
      const fx = e.focalX - pageOffset.get().x;
      const fy = e.focalY - pageOffset.get().y;
      const s0 = scale.get();
      const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (s0 * e.scale) / last.s));
      tx.set(fx - ((fx - tx.get()) / s0) * s1);
      ty.set(fy - ((fy - ty.get()) / s0) * s1);
      scale.set(s1);
    });

  const tapEmpty = Gesture.Tap().onEnd(() => scheduleOnRN(onClear));

  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tapEmpty);

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  // 點點格線跟著平移，看起來像 Figma 的無限畫布
  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (tx.get() % GRID) - GRID }, { translateY: (ty.get() % GRID) - GRID }],
  }));

  // 排隊時只擺隊伍裡的（封存的 / 還沒封存的另一邊不出現）
  const sorted = (queued ? items.filter((i) => queueSpots.has(i.id)) : [...items]).sort((a, b) => a.z - b.z);
  const floors = queued
    ? lanes.flatMap((lane, p) => lane.floors.map((f) => ({ ...f, key: `${p}:${f.key}`, x: f.x + laneX(p) })))
    : [];
  const signs = queued
    ? lanes.flatMap((lane, p) => lane.signs.map((sign) => ({ ...sign, key: `${p}:${sign.key}`, x: sign.x + laneX(p) })))
    : [];

  return (
    <View
      ref={containerRef}
      style={s.container}
      onLayout={(e) => {
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
        if (Platform.OS === 'web') {
          const rect = (containerRef.current as unknown as HTMLElement | null)?.getBoundingClientRect();
          if (rect) pageOffset.set({ x: rect.left, y: rect.top });
        }
      }}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <DotGrid style={gridStyle} width={size.w} height={size.h} />
          <Animated.View style={[s.world, worldStyle]}>
            {floors.map((f) => (
                  <Animated.View
                    key={f.key}
                    entering={FadeIn.delay(500)}
                    exiting={FadeOut}
                    layout={LinearTransition.duration(500)}
                    pointerEvents="none"
                    style={[s.floor, { left: f.x, top: f.y, width: f.w }, f.color ? { backgroundColor: f.color + '55' } : null]}
                  />
                ))}
            {signs.map((sign) => (
                  <Animated.View
                    key={sign.key}
                    entering={FadeIn.delay(300)}
                    exiting={FadeOut}
                    layout={LinearTransition.duration(500)}
                    pointerEvents="none"
                    style={[s.sign, { left: sign.x, top: sign.y }]}>
                    <View style={[s.signBoard, { backgroundColor: sign.color }]}>
                      <Text style={s.signText} numberOfLines={1}>
                        {sign.label}
                      </Text>
                      <View style={s.signCount}>
                        <Text style={[s.signCountText, { color: sign.color }]}>{sign.count}</Text>
                      </View>
                    </View>
                    <View style={[s.signPost, { backgroundColor: sign.color }]} />
                  </Animated.View>
                ))}
            {queued && size.w
              ? pages.map((p, i) => (
                  archive ? (
                    <AddCard
                      key={`archive-${p.key}`}
                      spot={addSpot(i)}
                      icon="arrow-undo"
                      label="回到隊伍"
                      sub={p.items.length ? '把狀態改回來，就會回到隊伍裡' : `沒有完成的${p.label}`}
                      onPress={toggleArchive}
                    />
                  ) : (
                    <AddCard
                      key={p.key}
                      spot={addSpot(i)}
                      icon="add-circle"
                      label={`新增${p.label}`}
                      sub={p.items.length ? '看完了～要貼新的嗎？' : `還沒有${p.label}，貼第一張吧`}
                      onPress={() => onAdd(p.key === 'notice')}
                    />
                  )
                ))
              : null}
            {/* 還不知道畫面多寬時先不擺，免得排隊的人一出現就要換位置 */}
            {size.w ? sorted.map((item) => {
              const picked = selectedIds.includes(item.id);
              return (
                <CanvasItem
                  key={item.id}
                  item={item}
                  spot={spotOf(item)}
                  queued={queued}
                  walkDelay={(orderOf.get(item.id) ?? 0) * walkStep}
                  move={moveOf(item)}
                  nervous={nervousness(item, isPending(item), now)}
                  now={now}
                  scale={scale}
                  busy={itemBusy}
                  group={groupDrag}
                  hit={hit}
                  stepOver={stepOver}
                  selected={picked}
                  multi={multi}
                  // 排隊時不能拖（在卡片上拖 = 捲動 / 換頁）；多選、用手指時只有選起來的能拖；用滑鼠時直接拖
                  draggable={!queued && (picked || (!multi && !TOUCH))}
                  pending={isPending(item)}
                  readCount={readCount(item)}
                  memberCount={memberCount}
                  onTap={onTap}
                  onLongPress={onLongPress}
                  onOpen={onOpen}
                  onToggleTask={onToggleTask}
                  onCommit={commit}
                  onCommitGroup={commitGroup}
                  onFit={queued ? reportFit : undefined}
                />
              );
            }) : null}
          </Animated.View>
        </View>
      </GestureDetector>

      {queued ? (
        <QueueTabs
          pages={pages}
          page={page}
          onChange={flipTo}
          archive={archive}
          archivedCount={archivedCount}
          onToggleArchive={toggleArchive}
        />
      ) : null}

      <ModeBar
        mode={queued ? 'queue' : 'free'}
        compact={queued && size.w < 440}
        // 再點一次目前的模式：排隊回到這頁開頭、自由擺放看全部
        onChange={(m) => (m === (queued ? 'queue' : 'free') ? fitAll() : onChangeMode(m))}
      />
    </View>
  );
}

/** 隊伍最後面的「新增」卡片；看封存時換成「回到隊伍」 */
function AddCard({
  spot,
  icon,
  label,
  sub,
  onPress,
}: {
  spot: { x: number; y: number; w: number };
  icon: 'add-circle' | 'arrow-undo';
  label: string;
  sub: string;
  onPress: () => void;
}) {
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(onPress);
    });
  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        entering={FadeIn.delay(400)}
        layout={LinearTransition.duration(500)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[s.add, { left: spot.x, top: spot.y, width: spot.w, height: ADD_H }]}>
        <Ionicons name={icon} size={34} color={C.primary} />
        <Text style={s.addText}>{label}</Text>
        <Text style={s.addSub}>{sub}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

/** 項目在白板上的位置與大小（只取這四個欄位） */
const geometryOf = (item: BoardItem): Geometry => ({ x: item.x, y: item.y, w: item.w, h: item.h });

function DotGrid({ style, width, height }: { style: object; width: number; height: number }) {
  if (!width) return null;
  const cols = Math.ceil(width / GRID) + 3;
  const rows = Math.ceil(height / GRID) + 3;
  // 網頁用 CSS 背景，手機用少量點點（大約 30x40 個）
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', width: width + GRID * 3, height: height + GRID * 3 },
          // 網頁專用 CSS 背景
          { backgroundImage: `radial-gradient(${C.dot} 1.5px, transparent 1.5px)`, backgroundSize: `${GRID}px ${GRID}px` },
          style,
        ]}
      />
    );
  }
  return (
    <Animated.View pointerEvents="none" style={[s.grid, style]}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={s.gridRow}>
          {Array.from({ length: cols }, (_, c) => (
            <View key={c} style={s.gridCell}>
              <View style={s.dot} />
            </View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const s = themed(() => ({
  container: { flex: 1, backgroundColor: C.canvas, overflow: 'hidden' },
  world: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: 'left top' },
  grid: { position: 'absolute' },
  gridRow: { flexDirection: 'row' },
  gridCell: { width: GRID, height: GRID, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.dot },
  floor: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: C.dot },
  // 白板世界只有 1px 寬，不給寬度的話牌子上的字會被擠成直的
  sign: { position: 'absolute', width: 480, alignItems: 'flex-start' },
  signBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 12,
    borderBottomWidth: 4,
    borderBottomColor: '#00000022',
  },
  signText: { fontSize: 17, fontFamily: F.display, color: '#FFF' },
  signCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  signCountText: { fontSize: 13, fontFamily: F.display },
  signPost: { width: 6, height: 10, marginLeft: 16, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, opacity: 0.7 },
  add: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 24,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: C.primary + '88',
    backgroundColor: '#FFFFFFAA',
  },
  addText: { fontSize: 18, fontFamily: F.display, color: C.primary },
  addSub: { fontSize: 13, fontFamily: F.display, color: C.sub },
}));
