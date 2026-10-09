import { Text, View } from 'react-native';

import { BACKGROUNDS, FOLLOW_THEME, THEMES } from '@/components/palettes';
import { useTheme } from '@/components/ThemeProvider';
import { C, F, Ionicons, Label, Squishy, themed } from '@/components/ui';

/** 設定裡的「配色」：整體配色主題＋另外換背景（預設跟著主題） */
export function ThemePicker({ first }: { first?: boolean }) {
  const { theme, background, setTheme, setBackground } = useTheme();
  const themeCanvas = (THEMES.find((t) => t.id === theme) ?? THEMES[0]).colors.canvas;
  const backgrounds = [
    { id: FOLLOW_THEME, label: '跟著主題', canvas: themeCanvas },
    ...BACKGROUNDS.map((b) => ({
      id: b.id,
      label: b.label,
      canvas: b.colors.canvas,
    })),
  ];

  return (
    <>
      <Label style={first && s.first}>整體配色</Label>
      <View style={s.grid}>
        {THEMES.map((t) => {
          const active = t.id === theme;
          return (
            <View key={t.id} style={s.cell}>
              <Squishy
                onPress={() => setTheme(t.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`配色：${t.label}`}
                style={[
                  s.theme,
                  {
                    backgroundColor: t.colors.bg,
                    borderColor: active ? t.colors.primary : t.colors.line,
                  },
                ]}>
                <View style={[s.preview, { backgroundColor: t.colors.canvas }]}>
                  <View style={[s.chip, { backgroundColor: t.colors.primary }]} />
                  <View style={[s.bar, { backgroundColor: t.colors.ink }]} />
                  <View style={[s.bar, s.barShort, { backgroundColor: t.colors.sub }]} />
                </View>
                <View style={s.themeFoot}>
                  <Text style={[s.themeName, { color: t.colors.ink }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                  {active ? <Ionicons name="checkmark-circle" size={16} color={t.colors.primary} /> : null}
                </View>
              </Squishy>
            </View>
          );
        })}
      </View>

      <Label>背景顏色</Label>
      <View style={s.bgRow}>
        {backgrounds.map((b) => {
          const active = b.id === background;
          return (
            <Squishy
              key={b.id}
              onPress={() => setBackground(b.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`背景：${b.label}`}
              style={s.bgItem}>
              <View
                style={[
                  s.swatch,
                  {
                    backgroundColor: b.canvas,
                    borderColor: active ? C.primary : C.line,
                  },
                ]}>
                {b.id === FOLLOW_THEME ? <Ionicons name="color-palette" size={18} color={C.sub} /> : null}
                {active && b.id !== FOLLOW_THEME ? <Ionicons name="checkmark" size={18} color={C.primary} /> : null}
              </View>
              <Text style={[s.bgLabel, active && { color: C.primary }]}>{b.label}</Text>
            </Squishy>
          );
        })}
      </View>
    </>
  );
}

const s = themed(() => ({
  first: { marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /** Squishy 會把寬度留在內層，所以由外面這格決定一張卡多寬 */
  cell: { width: '31%', flexGrow: 1 },
  theme: { borderRadius: 16, borderWidth: 2.5, padding: 6 },
  preview: { height: 54, borderRadius: 11, padding: 8, gap: 5 },
  chip: { width: 22, height: 10, borderRadius: 5 },
  bar: { height: 5, borderRadius: 3, width: '80%' },
  barShort: { width: '50%' },
  themeFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  themeName: { fontFamily: F.display, fontSize: 13, flexShrink: 1 },
  bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bgItem: { alignItems: 'center', width: 52 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgLabel: { fontSize: 11, color: C.sub, marginTop: 4 },
}));
