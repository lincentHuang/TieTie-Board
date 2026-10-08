import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { C, F, Ionicons, Squishy } from '@/components/ui';
import { itemTitle } from '@/lib/types';

import type { TodoEntry } from './todos';

/** 勾完之後打勾的樣子留多久，才換下一件 */
const HOLD_MS = 700;

/**
 * header 第二行的待辦小膠囊：最前面那件還沒做完的待辦。
 * 點左邊的圈圈直接打勾（打勾的樣子停一下再換下一件），點其他地方打開全部的待辦
 */
export function TodoPill({
  todos,
  style,
  onTick,
  onOpen,
}: {
  todos: TodoEntry[];
  style?: StyleProp<ViewStyle>;
  onTick: (entry: TodoEntry) => void;
  onOpen: () => void;
}) {
  /** 剛勾掉的那件：資料已經更新、不在 todos 裡了，先留著給大家看到打勾 */
  const [held, setHeld] = useState<TodoEntry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const entry = held ?? todos[0];
  if (!entry) return null;
  const text = entry.task ? entry.task.text : itemTitle(entry.item);
  // 清單裡的一項：後面小字標出是哪張清單
  const from = entry.task ? itemTitle(entry.item) : null;
  const left = todos.length;

  const tick = () => {
    if (held) return;
    setHeld(entry);
    onTick(entry);
    timer.current = setTimeout(() => setHeld(null), HOLD_MS);
  };

  return (
    <Squishy style={[s.pill, style]} onPress={onOpen} accessibilityLabel={`${left} 件待辦，打開待辦清單`}>
      <Pressable
        onPress={tick}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: held !== null }}
        accessibilityLabel={`完成「${text}」`}
        style={[s.box, held && s.boxOn]}>
        {held ? <Ionicons name="checkmark" size={14} color={C.mint} /> : null}
      </Pressable>
      <Animated.Text key={entry.key} entering={FadeIn.duration(250)} style={[s.text, held && s.done]} numberOfLines={1}>
        {text}
        {from ? <Text style={s.from}>・{from}</Text> : null}
      </Animated.Text>
      {left > 1 ? (
        <View style={s.count}>
          <Text style={s.countText}>{left}</Text>
        </View>
      ) : null}
    </Squishy>
  );
}

const s = StyleSheet.create({
  pill: {
    height: 32,
    borderRadius: 16,
    paddingLeft: 6,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.mint,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: '#FFF' },
  text: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: F.display },
  done: { textDecorationLine: 'line-through', opacity: 0.8 },
  from: { opacity: 0.8, fontSize: 12 },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#FFFFFF40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFF', fontSize: 12, fontFamily: F.display },
});
