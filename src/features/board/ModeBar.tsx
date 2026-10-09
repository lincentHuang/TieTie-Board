import { Pressable, Text, View } from 'react-native';

import { C, F, type IconName, Ionicons, themed } from '@/components/ui';

import type { ViewMode } from './useViewPrefs';

const MODES: { mode: ViewMode; icon: IconName; label: string; hint: string }[] = [
  { mode: 'queue', icon: 'walk', label: '排隊', hint: '排隊：公告和記事各排一隊、依日期排，上下捲、左右滑切換' },
  { mode: 'free', icon: 'hand-left', label: '自由', hint: '自由擺放：大家看到一樣的排版' },
];

/** 左上角切換怎麼看白板（只影響自己的畫面）；再點一次目前的模式 = 回到開頭 / 看全部；compact = 手機上右邊還有分頁，沒選的只放圖示 */
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

const s = themed(() => ({
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
}));
