import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colorOf, type Member } from '@/lib/types';

import { C, F, themed } from './ui';

/**
 * 成員頭像：有 LINE 大頭貼就放照片，沒有（或載入失敗）就是名字的第一個字，每個人固定一個顏色；
 * 還有公告沒看的人右上角有小圓點
 */
export function MemberAvatar({ member, size = 36, dot = false }: { member: Member; size?: number; dot?: boolean }) {
  const initial = Array.from(member.name.trim())[0] ?? '?';
  // 記住哪個網址載入失敗；換了新的大頭貼會再試一次
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = member.avatarUrl && member.avatarUrl !== failedUrl ? member.avatarUrl : null;
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[s.circle, round, { backgroundColor: colorOf(member.uid) }]} accessibilityLabel={member.name}>
      <Text style={[s.initial, { fontSize: Math.round(size * 0.46) }]}>{initial}</Text>
      {photo ? (
        <Image
          source={photo}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUrl(photo)}
        />
      ) : null}
      {dot ? <View style={s.dot} /> : null}
    </View>
  );
}

const s = themed(() => ({
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
}));
