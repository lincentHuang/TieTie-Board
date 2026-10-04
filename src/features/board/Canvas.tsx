import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { C, F, Ionicons, type IconName } from '@/components/ui';
import { byQueueOrder, type BoardItem, type Geometry } from '@/lib/types';

import { CanvasItem } from './CanvasItem';
import { QueueBar } from './QueueBar';
import { filterChips, groupQueue, matchesFilter, type Filter, type QueueGroup } from './queue-filter';
import { queueLayout } from './queue-layout';
import { useBlockPullToClose } from './useBlockPullToClose';

const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const GRID = 32;
/** 排隊模式：隊伍左右留白、上面留給按鈕和狀態列 */
const QUEUE_PAD = 24;
const BAR_TOP = 60;
/** 狀態列收起來時的高度；攤開後會變高，隊伍就往下讓位 */
const BAR_H = 42;
const BAR_GAP = 22;

export interface CanvasHandle {
  /** 目前畫面中心在白板上的座標 */
  viewCenter: () => { x: number; y: number };
  /** 把鏡頭移到這個項目；排隊時如果它被篩選藏起來，會先清掉篩選 */
  focus: (id: string) => void;
  fitAll: () => void;
}

interface Props {
  ref?: Ref<CanvasHandle>;
  items: BoardItem[];
  now: number;
  /** true = 排隊模式（只影響自己的畫面），false = 自由擺放（位置大家同步） */
  queued: boolean;
  onChangeMode: (queued: boolean) => void;
  /** 排隊時怎麼分隊 */
  group: QueueGroup;
  onChangeGroup: (group: QueueGroup) => void;
  selectedId: string | null;
  isPending: (item: BoardItem) => boolean;
  readCount: (item: BoardItem) => number;
  memberCount: number;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
  onCommit: (id: string, geo: Geometry) => void;
}

export function Canvas({
  ref,
  items,
  now,
  queued,
  onChangeMode,
  group,
  onChangeGroup,
  selectedId,
  isPending,
  readCount,
  memberCount,
  onSelect,
  onOpen,
  onCommit,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const start = useSharedValue({ tx: 0, ty: 0, s: 1, fx: 0, fy: 0 });
  // 正在拖曳 / 縮放白板上的項目時，畫布本身不要跟著移動
  const itemBusy = useSharedValue(false);
  const ignorePan = useSharedValue(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoomText, setZoomText] = useState('100%');
  const containerRef = useRef<View>(null);
  const didInitialFit = useRef(false);
  const wasQueued = useRef(queued);
  const lastWidth = useRef(0);
  // 篩選只影響自己的畫面，關掉 App 就清掉，免得下次打開漏看新公告
  const [filter, setFilter] = useState<Filter>([]);
  const [barH, setBarH] = useState(BAR_H);
  const queueTop = BAR_TOP + barH + BAR_GAP;

  // 排隊：篩選 → 照順序 → 分隊 → 一排一排站好，一排的寬度剛好是畫面寬（100% 時不用左右滑）
  const ctx = { now, isPending };
  const lineUp = (f: Filter, g: QueueGroup) => {
    const visible = queued ? items.filter((i) => matchesFilter(i, f, ctx)) : items;
    const secs = groupQueue([...visible].sort(byQueueOrder(now)), g, now);
    const widest = Math.max(0, ...visible.map((i) => i.w));
    return { visible, secs, layout: queueLayout(secs, Math.max(widest, size.w - QUEUE_PAD * 2)) };
  };
  const { visible: shown, secs: sections, layout: queue } = lineUp(filter, group);
  const spotOf = (item: BoardItem, q = queue): Geometry => (queued ? (q.spots.get(item.id) ?? item) : item);
  // 一個接一個出發，整隊最多等 1.2 秒
  const walkStep = Math.min(90, 1200 / Math.max(1, shown.length));
  const orderOf = new Map(sections.flatMap((sec) => sec.items).map((item, i) => [item.id, i]));

  const animateTo = (nx: number, ny: number, ns: number) => {
    const t = { duration: 350 };
    tx.set(withTiming(nx, t));
    ty.set(withTiming(ny, t));
    scale.set(withTiming(ns, t));
    setZoomText(`${Math.round(ns * 100)}%`);
  };

  /** 排隊模式的起始畫面：隊伍最前面、寬度剛好塞滿畫面 */
  const showQueue = (q = queue, top = queueTop) => {
    const s = Math.min(1, (size.w - QUEUE_PAD * 2) / Math.max(1, q.width));
    animateTo((size.w - q.width * s) / 2, top, s);
  };

  const fitAll = () => {
    if (!size.w || !size.h) return;
    if (items.length === 0) return animateTo(size.w / 2 - 150, size.h / 2 - 150, 1);
    if (queued) return showQueue();
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
    viewCenter: () => ({
      x: (size.w / 2 - tx.get()) / scale.get(),
      y: (size.h / 2 - ty.get()) / scale.get(),
    }),
    focus: (id) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      let q = queue;
      // 被篩選藏起來了 → 先清掉篩選，照清掉之後的隊伍找它站在哪
      if (!shown.includes(item)) {
        setFilter([]);
        q = lineUp([], group).layout;
      }
      const g = spotOf(item, q);
      const s = Math.min(1.5, Math.max(0.6, Math.min(size.w / (g.w * 1.6), size.h / (g.h * 1.6))));
      animateTo(size.w / 2 - (g.x + g.w / 2) * s, size.h / 2 - (g.y + g.h / 2) * s, s);
    },
    fitAll,
  }));

  // 換了篩選或分隊 → 隊伍重排，鏡頭回到隊伍開頭
  const changeFilter = (next: Filter) => {
    setFilter(next);
    showQueue(lineUp(next, group).layout);
  };
  const changeGroup = (next: QueueGroup) => {
    onChangeGroup(next);
    showQueue(lineUp(filter, next).layout);
  };
  const toggleFilter = (key: string) =>
    changeFilter(filter.includes(key) ? filter.filter((k) => k !== key) : [...filter, key]);
  // 狀態列攤開 / 收起 → 隊伍跟著往下讓位 / 回來，才不會被蓋住
  const resizeBar = (h: number) => {
    if (Math.abs(h - barH) < 1) return;
    setBarH(h);
    showQueue(queue, BAR_TOP + h + BAR_GAP);
  };

  // 選取的項目被篩選藏起來了 → 取消選取，免得工具列在操作看不到的東西
  const selectedHidden = selectedId !== null && items.some((i) => i.id === selectedId) && !shown.some((i) => i.id === selectedId);
  useEffect(() => {
    if (selectedHidden) onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHidden]);


  // 第一次拿到資料時，自動縮放到看得見全部
  useEffect(() => {
    if (didInitialFit.current || !size.w || items.length === 0) return;
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

  // 排隊時畫面寬度變了（轉向、調整視窗）→ 隊伍會重排，鏡頭也回到隊伍開頭
  useEffect(() => {
    const prev = lastWidth.current;
    lastWidth.current = size.w;
    if (queued && prev && prev !== size.w) showQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w]);

  const zoomAround = (fx: number, fy: number, ns: number) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns));
    tx.set(fx - ((fx - tx.get()) / scale.get()) * s);
    ty.set(fy - ((fy - ty.get()) / scale.get()) * s);
    scale.set(s);
    setZoomText(`${Math.round(s * 100)}%`);
  };

  // 網頁：滾輪平移、Ctrl/⌘ + 滾輪（或觸控板雙指捏合）縮放
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = containerRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
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

  const pan = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onStart(() => {
      ignorePan.set(itemBusy.get());
      start.set({ ...start.get(), tx: tx.get(), ty: ty.get() });
    })
    .onUpdate((e) => {
      if (ignorePan.get()) return;
      tx.set(start.get().tx + e.translationX);
      ty.set(start.get().ty + e.translationY);
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      start.set({ tx: tx.get(), ty: ty.get(), s: scale.get(), fx: e.focalX, fy: e.focalY });
    })
    .onUpdate((e) => {
      const st = start.get();
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, st.s * e.scale));
      tx.set(e.focalX - ((st.fx - st.tx) / st.s) * s);
      ty.set(e.focalY - ((st.fy - st.ty) / st.s) * s);
      scale.set(s);
    })
    .onEnd(() => {
      scheduleOnRN(setZoomText, `${Math.round(scale.get() * 100)}%`);
    });

  const tapEmpty = Gesture.Tap().onEnd(() => scheduleOnRN(onSelect, null));

  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tapEmpty);

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  // 點點格線跟著平移，看起來像 Figma 的無限畫布
  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (tx.get() % GRID) - GRID }, { translateY: (ty.get() % GRID) - GRID }],
  }));

  const sorted = [...shown].sort((a, b) => a.z - b.z);

  return (
    <View
      ref={containerRef}
      style={s.container}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <DotGrid style={gridStyle} width={size.w} height={size.h} />
          <Animated.View style={[s.world, worldStyle]}>
            {queued
              ? queue.floors.map((f) => (
                  <Animated.View
                    key={f.key}
                    entering={FadeIn.delay(500)}
                    exiting={FadeOut}
                    layout={LinearTransition.duration(500)}
                    pointerEvents="none"
                    style={[s.floor, { left: f.x, top: f.y, width: f.w }, f.color ? { backgroundColor: f.color + '55' } : null]}
                  />
                ))
              : null}
            {queued
              ? queue.signs.map((sign) => (
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
                ))
              : null}
            {/* 還不知道畫面多寬時先不擺，免得排隊的人一出現就要換位置 */}
            {size.w ? sorted.map((item) => (
              <CanvasItem
                key={item.id}
                item={item}
                spot={spotOf(item)}
                queued={queued}
                walkDelay={(orderOf.get(item.id) ?? 0) * walkStep}
                now={now}
                scale={scale}
                busy={itemBusy}
                selected={item.id === selectedId}
                pending={isPending(item)}
                readCount={readCount(item)}
                memberCount={memberCount}
                onSelect={onSelect}
                onOpen={onOpen}
                onCommit={onCommit}
              />
            )) : null}
          </Animated.View>
        </View>
      </GestureDetector>

      {queued && items.length > 0 && shown.length === 0 ? (
        <View style={[s.noMatch, { top: queueTop + 60 }]} pointerEvents="box-none">
          <Text style={s.noMatchTitle}>沒有符合的項目</Text>
          <Pressable onPress={() => changeFilter([])} style={({ pressed }) => [s.noMatchBtn, pressed && { opacity: 0.6 }]}>
            <Text style={s.noMatchBtnText}>看全部</Text>
          </Pressable>
        </View>
      ) : null}

      {queued ? (
        <QueueBar
          top={BAR_TOP}
          total={items.length}
          chips={filterChips(items, filter, ctx)}
          filter={filter}
          group={group}
          onToggle={toggleFilter}
          onClear={() => changeFilter([])}
          onChangeGroup={changeGroup}
          onResize={resizeBar}
        />
      ) : null}

      <View style={s.modeBar} accessibilityRole="radiogroup">
        <ModeButton icon="hand-left" label="自由" hint="自由擺放：大家看到一樣的排版" active={!queued} onPress={() => onChangeMode(false)} />
        <ModeButton icon="walk" label="排隊" hint="排隊：全部自動排整齊，只有你的畫面會變" active={queued} onPress={() => onChangeMode(true)} />
      </View>

      <View style={s.zoomBar}>
        <ZoomButton icon="remove" onPress={() => zoomAround(size.w / 2, size.h / 2, scale.get() / 1.25)} />
        <Pressable onPress={fitAll} style={s.zoomLabel}>
          <Text style={s.zoomText}>{zoomText}</Text>
        </Pressable>
        <ZoomButton icon="add" onPress={() => zoomAround(size.w / 2, size.h / 2, scale.get() * 1.25)} />
        <ZoomButton icon="scan-outline" onPress={fitAll} />
      </View>
    </View>
  );
}

function ModeButton({
  icon,
  label,
  hint,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={hint}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [s.modeBtn, active && s.modeBtnOn, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={16} color={active ? '#FFF' : C.sub} />
      <Text style={[s.modeText, active && { color: '#FFF' }]}>{label}</Text>
    </Pressable>
  );
}

function ZoomButton({ icon, onPress }: { icon: 'add' | 'remove' | 'scan-outline'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.zoomBtn, pressed && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={18} color={C.ink} />
    </Pressable>
  );
}

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

const s = StyleSheet.create({
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
  noMatch: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 12 },
  noMatchTitle: { fontSize: 20, fontFamily: F.display, color: C.sub },
  noMatchBtn: { backgroundColor: C.primary, borderRadius: 18, paddingHorizontal: 18, height: 38, justifyContent: 'center' },
  noMatchBtnText: { fontSize: 15, fontFamily: F.display, color: '#FFF' },
  modeBar: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFEE',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.line,
    padding: 3,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 11, borderRadius: 14 },
  modeBtnOn: { backgroundColor: C.primary },
  modeText: { fontSize: 13, fontFamily: F.display, color: C.sub },
  zoomBar: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFEE',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.line,
    padding: 3,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  zoomBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  zoomLabel: { minWidth: 50, height: 34, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 13, fontFamily: F.display, color: C.ink },
});
