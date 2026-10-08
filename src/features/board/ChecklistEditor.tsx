import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, F, Ionicons, Label } from '@/components/ui';
import { MAX_TASK_TEXT, MAX_TASKS, type Task } from '@/lib/types';

import { newTask } from './todos';

/**
 * 編輯便利貼的待辦清單：一格一項，按 Enter 接著寫下一項；收到換行（有些手機貼上時會保留）就拆成好幾項。
 * 這裡只編內容，打勾是大家在白板上做的
 */
export function ChecklistEditor({
  tasks,
  focusFirst,
  onChange,
}: {
  tasks: Task[];
  /** 新的待辦清單：一打開就從第一項開始寫 */
  focusFirst: boolean;
  onChange: (tasks: Task[]) => void;
}) {
  /** 剛加的那一項：出現時直接可以打字 */
  const [focusId, setFocusId] = useState<string | null>(focusFirst ? (tasks[0]?.id ?? null) : null);
  const full = tasks.length >= MAX_TASKS;

  const insertAt = (index: number, texts: string[] = ['']) => {
    const added = texts.slice(0, MAX_TASKS - tasks.length).map((t) => newTask(t));
    if (!added.length) return;
    onChange([...tasks.slice(0, index), ...added, ...tasks.slice(index)]);
    setFocusId(added[added.length - 1].id);
  };

  const edit = (index: number, text: string) => {
    // 一次貼上好幾行：第一行留在這一項，其他各自變成新的一項
    if (text.includes('\n')) {
      const [first, ...rest] = text.split(/\r?\n/).map((l) => l.trim());
      const next = [...tasks];
      next[index] = { ...next[index], text: first.slice(0, MAX_TASK_TEXT) };
      const added = rest
        .filter(Boolean)
        .slice(0, MAX_TASKS - tasks.length)
        .map((t) => newTask(t.slice(0, MAX_TASK_TEXT)));
      onChange([...next.slice(0, index + 1), ...added, ...next.slice(index + 1)]);
      if (added.length) setFocusId(added[added.length - 1].id);
      return;
    }
    onChange(tasks.map((t, i) => (i === index ? { ...t, text } : t)));
  };

  return (
    <>
      <Label>待辦清單{tasks.length ? `（${tasks.length}/${MAX_TASKS}）` : '（選填）'}</Label>
      {tasks.map((t, i) => (
        <View key={t.id} style={s.row}>
          <Ionicons name="ellipse-outline" size={22} color={C.dot} />
          <TextInput
            value={t.text}
            onChangeText={(text) => edit(i, text)}
            placeholder={i === 0 ? '例：買牛奶' : '下一項'}
            placeholderTextColor="#B9B2CF"
            maxLength={MAX_TASK_TEXT}
            autoFocus={t.id === focusId}
            returnKeyType="next"
            // 按 Enter 不要收鍵盤，直接接著寫下一項（手機用 submitBehavior、網頁版看 blurOnSubmit）
            submitBehavior="submit"
            blurOnSubmit={false}
            onSubmitEditing={() => (full ? undefined : insertAt(i + 1))}
            style={s.input}
          />
          <Pressable
            onPress={() => onChange(tasks.filter((x) => x.id !== t.id))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`刪掉「${t.text || '這一項'}」`}
            style={({ pressed }) => pressed && s.pressed}>
            <Ionicons name="close-circle" size={22} color={C.dot} />
          </Pressable>
        </View>
      ))}
      {full ? null : (
        <Pressable
          onPress={() => insertAt(tasks.length)}
          accessibilityRole="button"
          style={({ pressed }) => [s.add, pressed && s.pressed]}>
          <Ionicons name="add-circle" size={22} color={C.mint} />
          <Text style={s.addText}>{tasks.length ? '再加一項' : '加入待辦清單'}</Text>
        </Pressable>
      )}
      {tasks.length ? (
        <Text style={s.hint}>大家都可以打勾：點兩下卡片打開來勾，或點白板上方的待辦小膠囊直接勾。</Text>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
    fontFamily: F.display,
    color: C.ink,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.line,
    borderStyle: 'dashed',
  },
  addText: { fontSize: 15, fontFamily: F.display, color: C.ink },
  pressed: { opacity: 0.6 },
  hint: { fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 18 },
});
