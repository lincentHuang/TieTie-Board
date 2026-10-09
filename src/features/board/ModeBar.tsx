import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F, Ionicons, type IconName } from '@/components/ui';

import type { ViewMode } from './useViewPrefs';

const MODES: { mode: ViewMode; icon: IconName; label: string; hint: string }[] = [
  { mode: 'swipe', icon: 'list', label: '滑動', hint: '滑動：像網頁一樣上下捲，依日期排' },
  { mode: 'free', icon: 'hand-left', label: '自由', hint: '自由擺放：大家看到一樣的排版' },
  { mode: 'queue', icon: 'walk', label: '排隊', hint: '排隊：全部自動排整齊，只有你的畫面會變' },
];

/** 左上角切換怎麼看白板（只影響自己的畫面）；compact = 手機上右邊還有縮放按鈕，沒選的只放圖示 */
export function ModeBar({
  mode,
  compact = false,
  onChange,
}: {
  mode: ViewMode;
  compact?: boolean;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <View style={s.bar} accessibilityRole="radiogroup">
      {MODES.map((m) => {
        const active = m.mode === mode;
        return (
          <Pressable
            key={m.mode}
            onPress={() => onChange(m.mode)}
            accessibilityRole="radio"
            accessibilityLabel={m.hint}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [s.btn, active && s.btnOn, pressed && { opacity: 0.6 }]}>
            <Ionicons name={m.icon} size={16} color={active ? '#FFF' : C.sub} />
            {active || !compact ? <Text style={[s.text, active && { color: '#FFF' }]}>{m.label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
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
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 9, borderRadius: 14 },
  btnOn: { backgroundColor: C.primary },
  text: { fontSize: 13, fontFamily: F.display, color: C.sub },
});
