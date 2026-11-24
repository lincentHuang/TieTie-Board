import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, Ionicons, Squishy, themed } from '@/components/ui';

/** 回到 App 時最多多久檢查一次新版本 */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * App 自動更新（EAS Update 線上更新）：
 * - 每次開 App 由 expo-updates 自己檢查（app.json 的 checkAutomatically: ON_LOAD），在背景下載
 * - 從背景切回來時也檢查一次（最多 30 分鐘一次），有新版就在背景下載
 * - 下載好跳出底部提示「立即更新」；不按也沒關係，下次重新開 App 就是新版
 * 開發模式、Expo Go 不會動作；網頁版沒有這個功能（UpdateBanner.tsx 是空的）
 */
export function UpdateBanner() {
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  // 記住按掉的是哪一版；之後又下載到更新的版本時會再提示
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const lastCheck = useRef(0);
  const busy = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    lastCheck.current = Date.now(); // 剛開 App 時 expo-updates 已經檢查過
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || busy.current) return;
      if (Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      busy.current = true;
      lastCheck.current = Date.now();
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch (e) {
        // 沒網路或伺服器出錯就等下次再試，不打擾使用者
        console.warn('檢查更新失敗', e);
      } finally {
        busy.current = false;
      }
    });
    return () => sub.remove();
  }, []);

  const pendingId = downloadedUpdate?.updateId ?? null;
  if (!isUpdatePending || (pendingId !== null && pendingId === dismissedId)) return null;

  const restart = async () => {
    setRestarting(true);
    try {
      await Updates.reloadAsync({ reloadScreenOptions: { backgroundColor: '#3CC49A', fade: true } });
    } catch (e) {
      console.warn('套用更新失敗', e);
      setRestarting(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: insets.bottom + 16 }]}>
      <View style={s.card}>
        <Ionicons name="sparkles" size={20} color={C.primary} />
        <Text style={s.text}>新版本已經準備好了</Text>
        <Squishy onPress={restart} disabled={restarting} style={s.go}>
          <Text style={s.goText}>{restarting ? '更新中…' : '立即更新'}</Text>
        </Squishy>
        <Squishy onPress={() => setDismissedId(pendingId)} hitSlop={10} accessibilityLabel="稍後再更新">
          <Ionicons name="close" size={20} color={C.sub} />
        </Squishy>
      </View>
    </View>
  );
}

const s = themed(() => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    width: '100%',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: C.card,
    boxShadow: '0 4px 16px #00000026',
  },
  text: { flex: 1, color: C.ink, fontFamily: F.display, fontSize: 15 },
  go: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  goText: { color: '#FFF', fontFamily: F.display, fontSize: 14 },
}));
