import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

/** 手帳文具風配色：淡紫方格紙＋草莓牛奶粉＋薄荷＋奶油黃，文字用深莓紫取代黑色 */
export const C = {
  bg: '#FBF7FF',
  canvas: '#F4EEFF',
  dot: '#DCD2F5',
  ink: '#4B3F6B',
  sub: '#8C84A8',
  line: '#E9E2F7',
  card: '#FFFFFF',
  primary: '#FF6FA3',
  mint: '#5CCFB0',
  butter: '#FFD66B',
  sky: '#7CB8FF',
  lavender: '#B69CFF',
  urgent: '#FF5A6E',
  important: '#FF9F43',
  ok: '#3CC49A',
  /** LINE 品牌綠（「用 LINE 登入」、「傳到 LINE」按鈕） */
  lineGreen: '#06C755',
};

/** 粉圓體只有一種粗細，搭配時不要再設 fontWeight */
export const F = { display: 'Huninn_400Regular' };

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** 決定元件在版面中位置的樣式，要放在外層 Pressable 上才會生效 */
const LAYOUT_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'alignSelf',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
] as const;

/** 按下去會 Q 彈縮一下的按鈕底座 */
export function Squishy({ style, children, ...props }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: ViewStyle = {};
  const inner: ViewStyle = { ...flat };
  for (const key of LAYOUT_KEYS) {
    if (key in flat) {
      (outer as Record<string, unknown>)[key] = flat[key];
      delete (inner as Record<string, unknown>)[key];
    }
  }
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...props}
      style={outer}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(0.92, { damping: 15, stiffness: 400 }));
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 8, stiffness: 300 }));
        props.onPressOut?.(e);
      }}>
      <Animated.View style={[inner, anim, props.disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  label,
  icon,
  onPress,
  kind = 'primary',
  color,
  busy,
  disabled,
  style,
  big,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  kind?: 'primary' | 'ghost' | 'soft';
  color?: string;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const tint = color ?? C.primary;
  const fg = kind === 'primary' ? '#FFF' : tint;
  return (
    <Squishy
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        s.btn,
        big && s.btnBig,
        kind === 'primary' && { backgroundColor: tint, borderBottomWidth: 4, borderBottomColor: '#00000022' },
        kind === 'soft' && { backgroundColor: tint + '1F' },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={big ? 22 : 18} color={fg} /> : null}
          <Text style={[s.btnText, big && s.btnTextBig, { color: fg }]}>{label}</Text>
        </>
      )}
    </Squishy>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  /** null = 一個都沒選（例如多選時大家的狀態不一樣） */
  value: T | null;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segItem, active && { backgroundColor: o.color ?? C.primary }]}>
            <Text style={[s.segText, active && { color: '#FFF' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export { Ionicons };

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
  },
  btnBig: { height: 56, borderRadius: 28, paddingHorizontal: 22 },
  btnText: { fontSize: 15, fontFamily: F.display },
  btnTextBig: { fontSize: 19 },
  seg: { flexDirection: 'row', backgroundColor: '#F1EBFB', borderRadius: 18, padding: 4, gap: 4 },
  segItem: { flex: 1, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, fontFamily: F.display, color: C.ink },
  label: { fontSize: 14, fontFamily: F.display, color: C.sub, marginTop: 18, marginBottom: 8 },
});
