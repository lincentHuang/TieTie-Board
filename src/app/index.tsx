import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BoardScreen } from '@/features/board/BoardScreen';
import { SetupScreen } from '@/features/setup/SetupScreen';
import { C, F, Ionicons } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Home() {
  const session = useSession();

  useEffect(() => {
    if (session.status !== 'loading') SplashScreen.hideAsync();
  }, [session.status]);

  if (session.status === 'loading') {
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
  return session.groupId ? <BoardScreen key={session.groupId} /> : <SetupScreen />;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  errorTitle: { fontSize: 22, fontFamily: F.display, color: C.ink, marginTop: 8 },
  errorText: { fontSize: 15, color: C.sub, marginTop: 8, textAlign: 'center' },
});
