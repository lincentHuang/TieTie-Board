import { Text, View } from 'react-native';

import { Button, C, F, themed } from '@/components/ui';

/** 已經交給 Android App 了：LINE 裡留著這個畫面，App 沒打開的話可以在這裡繼續 */
export function AppHandoff({ onStay, onStopAuto }: { onStay: () => void; onStopAuto: () => void }) {
  return (
    <View style={s.center}>
      <Text style={s.emoji}>📲</Text>
      <Text style={s.title}>已經用 App 打開</Text>
      <Text style={s.text}>沒有跳到 App 的話，可能是這支手機還沒裝貼貼公布欄 App，或是 LINE 要更新</Text>
      <View style={s.actions}>
        <Button color={C.lineGreen} icon="chatbubble-ellipses" label="在 LINE 裡繼續" onPress={onStay} />
        <Button kind="ghost" color={C.sub} label="以後不要自動用 App 打開" onPress={onStopAuto} />
      </View>
    </View>
  );
}

const s = themed(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  emoji: { fontSize: 64 },
  title: { fontSize: 22, fontFamily: F.display, color: C.ink, marginTop: 8 },
  text: { fontSize: 15, color: C.sub, marginTop: 8, textAlign: 'center', lineHeight: 22, maxWidth: 360 },
  actions: { width: '100%', maxWidth: 360, marginTop: 24, gap: 10 },
}));
