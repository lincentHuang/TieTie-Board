import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { C, F, Ionicons, Label } from '@/components/ui';
import { STATUS_META, isTaskDone, itemTitle, taskProgress, type BoardItem, type Member } from '@/lib/types';
import { useNow } from '@/lib/use-now';

import { TaskRow } from './Checklist';
import { checkerName, openTodos, type TodoEntry } from './todos';

/**
 * 白板上所有的待辦（點 header 第二行的待辦小膠囊打開）：還沒做完的都列在這裡，直接勾。
 * 這次打開時列出來的，勾完也先留著（劃掉、不跳位置），勾錯了可以馬上取消
 */
export function TodoSheet({
  items,
  members,
  uid,
  onTick,
  onLocate,
  onClose,
}: {
  items: BoardItem[];
  members: Member[];
  uid: string;
  /** done = true 打勾，false 取消 */
  onTick: (entry: TodoEntry, done: boolean) => void;
  onLocate: (item: BoardItem) => void;
  onClose: () => void;
}) {
  const now = useNow();
  const open = openTodos(items, now);
  const idsOf = (list: TodoEntry[]) => [...new Set(list.map((e) => e.item.id))];
  // 打開時有哪幾張、照什麼順序；之後新冒出來的接在後面
  const [order] = useState(() => idsOf(open));
  const shown = [...order, ...idsOf(open).filter((id) => !order.includes(id))]
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is BoardItem => i !== undefined);
  const lists = shown.filter((i) => i.tasks.length > 0);
  const singles = shown.filter((i) => i.tasks.length === 0);

  return (
    <Sheet visible title="待辦清單" onClose={onClose}>
      {open.length === 0 ? (
        <View style={s.allDone}>
          <Ionicons name="checkmark-done-circle" size={44} color={C.ok} />
          <Text style={s.allDoneText}>{shown.length ? '全部做完了，好棒！' : '現在沒有待辦'}</Text>
          {shown.length ? null : (
            <Text style={s.allDoneHint}>用下面工具列的「待辦」貼一張待辦清單；便利貼的狀態設成「待辦」也會出現在這裡。</Text>
          )}
        </View>
      ) : (
        <Text style={s.summary}>還有 {open.length} 件沒做完・大家都可以勾</Text>
      )}

      {lists.map((item) => {
        const progress = taskProgress(item);
        return (
          <View key={item.id} style={[s.card, { backgroundColor: item.color === 'transparent' ? C.card : item.color }]}>
            <Pressable
              onPress={() => onLocate(item)}
              accessibilityRole="button"
              accessibilityLabel={`在白板上找到「${itemTitle(item)}」`}
              style={({ pressed }) => [s.head, pressed && s.pressed]}>
              <Text style={s.title} numberOfLines={1}>
                {itemTitle(item)}
              </Text>
              <Text style={s.count}>
                {progress.done}/{progress.total}
              </Text>
              <Ionicons name="locate" size={18} color={C.sub} />
            </Pressable>
            {item.tasks.map((t) => {
              const done = isTaskDone(item, t.id);
              return (
                <TaskRow
                  key={t.id}
                  text={t.text}
                  done={done}
                  by={done ? checkerName(item, t.id, uid, members) : undefined}
                  onToggle={() => onTick({ key: `${item.id}/${t.id}`, item, task: t }, !done)}
                />
              );
            })}
          </View>
        );
      })}

      {singles.length ? (
        <>
          <Label>狀態是待辦的便利貼</Label>
          <View style={[s.card, { backgroundColor: C.card }]}>
            {singles.map((item) => {
              const done = item.status === 'done';
              return (
                <View key={item.id} style={s.single}>
                  <View style={{ flex: 1 }}>
                    <TaskRow text={itemTitle(item)} done={done} onToggle={() => onTick({ key: item.id, item, task: null }, !done)} />
                  </View>
                  {item.status === 'doing' ? (
                    <View style={[s.chip, { backgroundColor: STATUS_META.doing.color }]}>
                      <Text style={s.chipText}>{STATUS_META.doing.label}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => onLocate(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`在白板上找到「${itemTitle(item)}」`}
                    style={({ pressed }) => pressed && s.pressed}>
                    <Ionicons name="locate" size={18} color={C.sub} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  summary: { fontSize: 14, fontFamily: F.display, color: C.sub, marginBottom: 10 },
  allDone: { alignItems: 'center', gap: 6, paddingVertical: 18 },
  allDoneText: { fontSize: 18, fontFamily: F.display, color: C.ink },
  allDoneHint: { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  card: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#0000000D',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  title: { flex: 1, fontSize: 18, fontFamily: F.display, color: C.ink },
  count: { fontSize: 13, fontFamily: F.display, color: C.sub },
  pressed: { opacity: 0.6 },
  single: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 12, fontFamily: F.display, color: '#FFF' },
});
