import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { C, F, Ionicons } from '@/components/ui';
import { useBlockPullToClose } from '@/components/useBlockPullToClose';
import type { BoardItem } from '@/lib/types';

import type { CanvasHandle } from './Canvas';
import { ItemBody } from './ItemBody';
import { ModeBar } from './ModeBar';
import { feedSections } from './swipe-order';
import type { ViewMode } from './useViewPrefs';

/** 上面留給模式按鈕，下面留給工具列 */
const TOP = 64;
const BOTTOM = 160;
const SIDE = 16;
/** 一欄最寬多少（電腦上不要拉得太開） */
const MAX_COLUMN = 560;
/** 小卡片最多放大幾倍：再小的卡片就照這個倍數、版面拉寬到跟大家一樣寬 */
const MAX_SCALE = 1.6;
const HEADER_H = 44;
const GAP = 14;
const ADD_H = 120;
/** 兩次點擊在這麼短的時間內算點兩下 */
const DOUBLE_TAP_MS = 400;
/** 現在幾點（只在點擊時叫，算點兩下用；網頁版的按壓事件沒有可靠的時間） */
const clock = () => Date.now();

type Row =
  | { kind: 'header'; key: string; label: string; count: number }
  | { kind: 'card'; key: string; item: BoardItem }
  | { kind: 'add'; key: string };

interface Props {
  ref?: Ref<CanvasHandle>;
  items: BoardItem[];
  now: number;
  onChangeMode: (mode: ViewMode) => void;
  selectedIds: string[];
  isPending: (item: BoardItem) => boolean;
  readCount: (item: BoardItem) => number;
  memberCount: number;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  onOpen: (id: string) => void;
  /** 最下面的「新增公告」 */
  onAdd: () => void;
}

/** 滑動模式：像一般網頁一樣，卡片同寬排成一欄上下捲，依日期分段（只影響自己的畫面） */
export function SwipeBoard({
  ref,
  items,
  now,
  onChangeMode,
  selectedIds,
  isPending,
  readCount,
  memberCount,
  onTap,
  onLongPress,
  onOpen,
  onAdd,
}: Props) {
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<Row>>(null);
  const containerRef = useRef<View>(null);
  const lastTap = useRef({ id: '', t: 0 });
  const sections = feedSections(items, now);
  const column = Math.min(MAX_COLUMN, Math.max(0, width - SIDE * 2));
  /** 每張卡片放大幾倍：寬的縮到一欄寬；窄的最多放大 MAX_SCALE 倍，剩下的靠拉寬版面補滿 */
  const scaleOf = (item: BoardItem) => Math.min(MAX_SCALE, column / item.w);

  const rows: Row[] = [
    ...sections.flatMap((sec): Row[] => [
      { kind: 'header', key: `h-${sec.key}`, label: sec.label, count: sec.items.length },
      ...sec.items.map((item): Row => ({ kind: 'card', key: item.id, item })),
    ]),
    { kind: 'add', key: 'add' },
  ];
  // 每一列的高度都算得出來：跳到某張卡片時才能直接捲過去
  const heightOf = (row: Row) =>
    row.kind === 'header' ? HEADER_H : row.kind === 'add' ? ADD_H + GAP : row.item.h * scaleOf(row.item) + GAP;
  const offsets: number[] = [];
  rows.forEach((row, i) => offsets.push(i ? offsets[i - 1] + heightOf(rows[i - 1]) : 0));

  useImperativeHandle(ref, () => ({
    // 這個模式沒有白板座標：新項目由外面決定放哪
    viewCenter: () => ({ x: NaN, y: NaN }),
    focus: (id) => {
      const i = rows.findIndex((r) => r.kind === 'card' && r.item.id === id);
      if (i >= 0) list.current?.scrollToOffset({ offset: Math.max(0, offsets[i] - HEADER_H), animated: true });
    },
    fitAll: () => list.current?.scrollToOffset({ offset: 0, animated: true }),
    visibleIds: () => sections.flatMap((sec) => sec.items.map((i) => i.id)),
  }));

  // 網頁：iPhone 的 LINE 瀏覽器往下拖會關掉頁面（會捲動的清單本身照常可以滑）
  useBlockPullToClose(containerRef);

  /** 點一下選起來（工具列換成這張的操作），點兩下打開來看 */
  const tap = (id: string) => {
    const t = clock();
    const last = lastTap.current;
    lastTap.current = { id, t };
    if (last.id === id && t - last.t < DOUBLE_TAP_MS) {
      lastTap.current = { id: '', t: 0 };
      onOpen(id);
      return;
    }
    onTap(id);
  };

  return (
    <View ref={containerRef} style={s.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {column ? (
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(r) => r.key}
          getItemLayout={(_, index) => ({ length: heightOf(rows[index]), offset: offsets[index], index })}
          contentContainerStyle={{ paddingTop: TOP, paddingBottom: BOTTOM, alignItems: 'center' }}
          initialNumToRender={8}
          renderItem={({ item: row }) =>
            row.kind === 'header' ? (
              <View style={[s.header, { width: column, height: HEADER_H }]}>
                <Text style={s.headerText}>{row.label}</Text>
                <Text style={s.headerCount}>{row.count}</Text>
              </View>
            ) : row.kind === 'card' ? (
              <FeedCard
                item={row.item}
                now={now}
                column={column}
                scale={scaleOf(row.item)}
                selected={selectedIds.includes(row.item.id)}
                pending={isPending(row.item)}
                readCount={readCount(row.item)}
                memberCount={memberCount}
                onPress={() => tap(row.item.id)}
                onLongPress={() => onLongPress(row.item.id)}
              />
            ) : (
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel="新增公告"
                style={({ pressed }) => [s.add, { width: column, height: ADD_H }, pressed && { opacity: 0.6 }]}>
                <Ionicons name="add-circle" size={36} color={C.primary} />
                <Text style={s.addText}>新增公告</Text>
                <Text style={s.addSub}>{rows.length > 1 ? '看完了～要貼新的嗎？' : '還沒有東西，貼第一張吧'}</Text>
              </Pressable>
            )
          }
        />
      ) : null}

      <ModeBar mode="swipe" onChange={onChangeMode} />
    </View>
  );
}

/**
 * 一欄裡的一張卡片：大家一樣寬。
 * 照比例放大；窄的卡片放大到上限後，版面直接拉寬（高度不變，文字只會更好排）
 */
function FeedCard({
  item,
  now,
  column,
  scale,
  selected,
  pending,
  readCount,
  memberCount,
  onPress,
  onLongPress,
}: {
  item: BoardItem;
  now: number;
  column: number;
  scale: number;
  selected: boolean;
  pending: boolean;
  readCount: number;
  memberCount: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const layoutW = column / scale;
  // ItemBody 要的是白板拖曳用的動畫值；這裡不會拖，給固定的大小就好
  const w = useSharedValue(layoutW);
  const h = useSharedValue(item.h);
  useEffect(() => {
    w.set(layoutW);
    h.set(item.h);
  }, [layoutW, item.h, w, h]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityHint="點一下選取，點兩下打開來看，長按可以多選"
      style={{ width: column, height: item.h * scale, marginBottom: GAP }}>
      <View style={[s.card, { width: layoutW, height: item.h, transform: [{ scale }] }]}>
        <ItemBody item={item} now={now} pending={pending} readCount={readCount} memberCount={memberCount} tidy w={w} h={h} />
      </View>
      {selected ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.outline]} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.canvas, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  headerText: { fontSize: 17, fontFamily: F.display, color: C.ink },
  headerCount: {
    minWidth: 22,
    height: 22,
    lineHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: F.display,
    color: '#FFF',
    backgroundColor: C.lavender,
    overflow: 'hidden',
  },
  // 照版面大小排好再整張縮放：以左上角為準，外面的 Pressable 已經是縮放後的大小
  card: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top' },
  outline: { borderWidth: 3, borderColor: C.primary, borderRadius: 20, margin: -5 },
  add: {
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
});
