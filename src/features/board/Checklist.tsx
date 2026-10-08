import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { C, F, Ionicons } from '@/components/ui';
import { isTaskDone, type BoardItem } from '@/lib/types';

import { orderedTasks } from './todos';

/** 白板卡片上的待辦清單：只是看（卡片要能拖），打勾要點兩下打開、或從上面的待辦小膠囊勾 */
export function CardTasks({ item, fontSize }: { item: BoardItem; fontSize: number }) {
  const size = Math.max(14, Math.min(24, Math.round(fontSize * 0.8)));
  return (
    <View pointerEvents="none" style={s.cardList}>
      {orderedTasks(item).map((t) => {
        const done = isTaskDone(item, t.id);
        return (
          <View key={t.id} style={s.cardRow}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={size + 3}
              color={done ? C.ok : C.sub}
              style={{ marginTop: Math.round(size * 0.05) }}
            />
            <Text style={[s.cardText, { fontSize: size, lineHeight: Math.round(size * 1.3) }, done && s.doneText]} numberOfLines={2}>
              {t.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** 可以打勾的一項待辦（檢視畫面、待辦面板）：勾好的劃掉，後面標是誰勾的 */
export function TaskRow({
  text,
  done,
  by,
  onToggle,
}: {
  text: string;
  done: boolean;
  /** 誰勾的（只有勾好的才顯示） */
  by?: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={text}
      hitSlop={4}
      style={({ pressed }) => [s.row, pressed && s.pressed]}>
      <View style={[s.box, done && s.boxOn]}>
        {done ? (
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <Ionicons name="checkmark" size={18} color="#FFF" />
          </Animated.View>
        ) : null}
      </View>
      <Text style={[s.text, done && s.doneText]}>{text}</Text>
      {done && by ? (
        <Text style={s.by} numberOfLines={1}>
          {by}
        </Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  cardList: { gap: 4, marginTop: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardText: { flex: 1, color: C.ink, fontFamily: F.display },
  doneText: { opacity: 0.45, textDecorationLine: 'line-through' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, minHeight: 44 },
  pressed: { opacity: 0.6 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: C.dot,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: C.ok, borderColor: C.ok },
  text: { flex: 1, fontSize: 17, lineHeight: 23, fontFamily: F.display, color: C.ink },
  by: { maxWidth: 90, fontSize: 12, fontFamily: F.display, color: C.sub },
});
