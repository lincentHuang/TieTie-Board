import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';

import { C, F, Ionicons, type IconName } from '../ui';
import { GROUP_OPTIONS, type Chip, type Filter, type QueueGroup } from './queue-filter';

const GROUP_ICONS: Record<QueueGroup, IconName> = {
  none: 'reorder-four',
  status: 'checkbox',
  kind: 'shapes',
  tag: 'pricetags',
};

/** 排隊模式上方的狀態列：每種各有幾則，點一下就只看那一種；最前面可以選怎麼分隊 */
export function QueueBar({
  top,
  total,
  chips,
  filter,
  group,
  onToggle,
  onClear,
  onChangeGroup,
  onResize,
}: {
  top: number;
  total: number;
  chips: Chip[];
  filter: Filter;
  group: QueueGroup;
  onToggle: (key: string) => void;
  onClear: () => void;
  onChangeGroup: (group: QueueGroup) => void;
  /** 狀態列的高度變了（攤開 / 收起） */
  onResize: (height: number) => void;
}) {
  const [menu, setMenu] = useState(false);
  // 一排放不下時，可以左右滑，也可以按「更多」全部攤開
  const [expanded, setExpanded] = useState(false);
  const [barW, setBarW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const overflow = contentW > barW + 1;
  const current = GROUP_OPTIONS.find((o) => o.value === group) ?? GROUP_OPTIONS[0];
  const barRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  // 網頁：滑鼠滾輪在狀態列上 → 左右捲動狀態列，不要讓後面的白板跟著移動
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = barRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const node = scrollRef.current?.getScrollableNode() as HTMLElement | undefined;
      const vertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
      if (node && vertical && !e.ctrlKey && !e.metaKey) node.scrollLeft += e.deltaY;
      // 觸控板左右滑交給瀏覽器自己捲；上下滾、捏合縮放都不要動到整個頁面
      if (!node || vertical || e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const chipList = (
    <>
      <Pressable
        onPress={() => setMenu((m) => !m)}
        accessibilityRole="button"
        accessibilityLabel={`分隊方式：${current.label}`}
        style={({ pressed }) => [s.chip, s.groupBtn, group !== 'none' && s.groupBtnOn, pressed && s.pressed]}>
        <Ionicons name={GROUP_ICONS[group]} size={15} color={group !== 'none' ? '#FFF' : C.ink} />
        <Text style={[s.chipText, group !== 'none' && s.white]}>{group === 'none' ? '分隊' : current.label}</Text>
        <Ionicons name={menu ? 'chevron-up' : 'chevron-down'} size={13} color={group !== 'none' ? '#FFF' : C.sub} />
      </Pressable>
      <View style={s.divider} />
      <FilterChip label="全部" count={total} color={C.ink} active={filter.length === 0} onPress={onClear} />
      {chips.map((c) => (
        <FilterChip
          key={c.key}
          label={c.label}
          count={c.count}
          color={c.color}
          active={filter.includes(c.key)}
          onPress={() => onToggle(c.key)}
        />
      ))}
    </>
  );

  return (
    <>
      <Animated.View entering={FadeInUp} exiting={FadeOut} style={[s.bar, { top }]}>
        <View
          ref={barRef}
          onLayout={(e) => {
            setBarW(e.nativeEvent.layout.width);
            onResize(e.nativeEvent.layout.height);
          }}
          style={expanded && s.panel}>
          {expanded ? (
            <View style={[s.row, s.wrap]}>
              {chipList}
              <Pressable
                onPress={() => setExpanded(false)}
                accessibilityRole="button"
                accessibilityLabel="收起分類"
                style={({ pressed }) => [s.chip, s.moreBtn, pressed && s.pressed]}>
                <Text style={s.chipText}>收起</Text>
                <Ionicons name="chevron-up" size={13} color={C.sub} />
              </Pressable>
            </View>
          ) : (
            <View style={s.line}>
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={(w) => setContentW(w)}
                style={{ flex: 1 }}
                contentContainerStyle={s.row}>
                {chipList}
              </ScrollView>
              {overflow ? (
                <Pressable
                  onPress={() => setExpanded(true)}
                  accessibilityRole="button"
                  accessibilityLabel="顯示全部分類"
                  style={({ pressed }) => [s.chip, s.moreBtn, s.moreFixed, pressed && s.pressed]}>
                  <Text style={s.chipText}>更多</Text>
                  <Ionicons name="chevron-down" size={13} color={C.sub} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </Animated.View>

      {menu ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel="關閉分隊選單" />
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[s.menu, { top: top + 46 }]}>
            <Text style={s.menuTitle}>怎麼分隊？</Text>
            {GROUP_OPTIONS.map((o) => {
              const on = o.value === group;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setMenu(false);
                    onChangeGroup(o.value);
                  }}
                  style={({ pressed }) => [s.option, on && s.optionOn, pressed && s.pressed]}>
                  <View style={[s.optionIcon, on && { backgroundColor: C.primary }]}>
                    <Ionicons name={GROUP_ICONS[o.value]} size={16} color={on ? '#FFF' : C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionLabel}>{o.label}</Text>
                    <Text style={s.optionHint}>{o.hint}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark" size={18} color={C.primary} /> : null}
                </Pressable>
              );
            })}
          </Animated.View>
        </>
      ) : null}
    </>
  );
}

function FilterChip({
  label,
  count,
  color,
  active,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${label}，${count} 則`}
      style={({ pressed }) => [s.chip, active && { backgroundColor: color, borderColor: color }, pressed && s.pressed]}>
      <Text style={[s.chipText, active && s.white]}>{label}</Text>
      <View style={[s.count, { backgroundColor: active ? '#FFFFFF44' : color + '1F' }]}>
        <Text style={[s.countText, { color: active ? '#FFF' : color }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 5,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0 },
  line: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4 },
  wrap: { flexWrap: 'wrap', rowGap: 8, paddingVertical: 10 },
  // 攤開時墊一塊半透明底，才看得清楚、不會跟後面的公告混在一起
  panel: {
    marginHorizontal: 8,
    borderRadius: 22,
    backgroundColor: '#F4EEFFF2',
    borderWidth: 2,
    borderColor: C.line,
    shadowColor: '#6B4FA8',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingLeft: 12,
    paddingRight: 5,
    borderRadius: 17,
    backgroundColor: '#FFFFFFF2',
    borderWidth: 2,
    borderColor: C.line,
    ...shadow,
  },
  groupBtn: { paddingRight: 10, gap: 4 },
  groupBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
  moreBtn: { paddingRight: 10, gap: 3 },
  moreFixed: { marginRight: 12, marginLeft: 2 },
  chipText: { fontSize: 13, fontFamily: F.display, color: C.ink },
  white: { color: '#FFF' },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, fontFamily: F.display },
  divider: { width: 2, height: 20, borderRadius: 1, backgroundColor: C.dot },
  pressed: { opacity: 0.6 },
  menu: {
    position: 'absolute',
    left: 12,
    width: 270,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.line,
    padding: 8,
    shadowColor: '#6B4FA8',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuTitle: { fontSize: 13, fontFamily: F.display, color: C.sub, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14 },
  optionOn: { backgroundColor: '#FFF0F6' },
  optionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFE3EE', alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 15, fontFamily: F.display, color: C.ink },
  optionHint: { fontSize: 12, color: C.sub, marginTop: 1 },
});
