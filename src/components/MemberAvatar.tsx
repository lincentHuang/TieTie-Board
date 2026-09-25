import { StyleSheet, Text, View } from 'react-native';

import { colorOf, type Member } from '@/lib/types';

import { C, F } from './ui';

/** 成員頭像：名字的第一個字，每個人固定一個顏色；還有公告沒看的人右上角有小圓點 */
export function MemberAvatar({ member, size = 36, dot = false }: { member: Member; size?: number; dot?: boolean }) {
  const initial = Array.from(member.name.trim())[0] ?? '?';
  return (
    <View
      style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorOf(member.uid) }]}
      accessibilityLabel={member.name}>
      <Text style={[s.initial, { fontSize: Math.round(size * 0.46) }]}>{initial}</Text>
      {dot ? <View style={s.dot} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  initial: { fontFamily: F.display, color: '#FFF' },
  dot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
