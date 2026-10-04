import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F, Ionicons, Squishy } from '@/components/ui';

import { APK_URL } from './install';
import { hideInstallHint, useInstall, useInstallHint } from './useInstall';

/** 手機網頁版的安裝提醒（浮在工具列上面）：點了打開設定的「裝到手機」，按 ✕ 一週內不再出現 */
export function InstallBanner({ bottom, onOpen }: { bottom: number; onOpen: () => void }) {
  const { env } = useInstall();
  const visible = useInstallHint(env);
  if (!env || !visible) return null;

  const sub = env.inLine
    ? '先用手機的瀏覽器打開，就能安裝'
    : env.platform === 'android' && APK_URL
      ? '家人通報、新公告時手機會跳通知'
      : '加到主畫面，一點就打開';

  return (
    <View style={[s.wrap, { bottom }]} pointerEvents="box-none">
      <View style={s.inner}>
        <Squishy onPress={onOpen} style={s.card} accessibilityLabel="把公布欄裝到手機">
          <Text style={s.icon}>📲</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>把公布欄裝到手機</Text>
            <Text style={s.sub} numberOfLines={1}>
              {sub}
            </Text>
          </View>
          <View style={s.action}>
            <Text style={s.actionText}>安裝</Text>
          </View>
        </Squishy>
        <Pressable onPress={() => hideInstallHint(7)} hitSlop={10} style={s.close} accessibilityLabel="之後再說">
          <Ionicons name="close" size={14} color={C.sub} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 480 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFC2D6',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: '#6B4FA8',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: { fontSize: 24 },
  title: { fontFamily: F.display, fontSize: 16, color: C.ink },
  sub: { fontFamily: F.display, fontSize: 12, color: C.sub, marginTop: 1 },
  action: { backgroundColor: C.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontFamily: F.display, fontSize: 14, color: '#FFF' },
  close: {
    position: 'absolute',
    top: -8,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
