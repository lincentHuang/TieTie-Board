import { router, useLocalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useOpenFromNotification } from '@/features/alerts/useOpenFromNotification';
import { BoardScreen } from '@/features/board/BoardScreen';
import { SetupScreen } from '@/features/setup/SetupScreen';
import { useJoinFromLink } from '@/features/setup/useJoinFromLink';
import { usePendingJoins } from '@/features/setup/usePendingJoins';
import { C, F, Ionicons } from '@/components/ui';
import { joinCodeFrom } from '@/lib/line';
import { useSession } from '@/lib/session';

export default function Home() {
  const session = useSession();
  // 從桌面小工具或通知點進來：?board=邀請碼 打開那個公布欄，再加 &alert=1 會直接打開快速通報
  // 從邀請連結點進來：?join=邀請碼（LINE 轉址時會包在 liff.state 裡）
  const params = useLocalSearchParams<{ board?: string; alert?: string; join?: string; 'liff.state'?: string }>();
  const { board, alert } = params;
  const known = typeof board === 'string' && session.groupIds.includes(board);
  const joinCode = joinCodeFrom(params);
  const joining = useJoinFromLink(joinCode);
  // 送出加入申請、等房主同意的公布欄：同意了就自動加入
  usePendingJoins();
  useOpenFromNotification();

  useEffect(() => {
    if (session.status !== 'loading') SplashScreen.hideAsync();
  }, [session.status]);

  useEffect(() => {
    if (session.status !== 'ready' || !board) return;
    if (known && board !== session.groupId) {
      session.switchGroup(board).catch((e) => console.warn('切換公布欄失敗', e));
      return;
    }
    // 已經切過去了（或不是這台裝置加入的公布欄）→ 參數用完就清掉，下次點同一個連結才會再生效
    router.setParams({ board: undefined });
  }, [board, known, session]);

  if (session.status === 'loading' || joining) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }
  if (session.status === 'error') {
    return (
      <View style={s.center}>
        <Ionicons name="cloud-offline" size={72} color={C.sub} />
        <Text style={s.errorTitle}>連不上公布欄</Text>
        <Text style={s.errorText}>{session.error}</Text>
      </View>
    );
  }
  return session.groupId ? (
    <BoardScreen
      key={session.groupId}
      // 要切換公布欄時，等切過去再打開，通報才會發到對的公布欄
      quickAlert={alert === '1' && !board}
      onCloseQuickAlert={() => router.setParams({ alert: undefined })}
    />
  ) : (
    <SetupScreen initialCode={joinCode ?? undefined} />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  errorTitle: { fontSize: 22, fontFamily: F.display, color: C.ink, marginTop: 8 },
  errorText: { fontSize: 15, color: C.sub, marginTop: 8, textAlign: 'center' },
});
