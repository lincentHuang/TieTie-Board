import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { C } from '@/components/ui';

import { pinSource, viewAt, type WidgetSource } from '../widget-data';
import { BoardAndroidWidget } from './BoardAndroidWidget';
import { loadPick, loadPin, loadSource, savePin } from './storage';

/**
 * Android 小工具放到桌面（或長按 →「設定」）時跳出來：選這個小工具要看哪個公布欄。
 * 這個畫面由系統直接開，不經過 App 的路由和 Provider，所以只用最基本的元件跟固定顏色。
 */
export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const { widgetId, width, height } = widgetInfo;
  const [source, setSource] = useState<WidgetSource | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSource(), loadPin(widgetId)])
      .then(([src, saved]) => {
        setSource(src);
        setPin(saved);
      })
      .catch((e) => {
        console.warn('讀小工具資料失敗', e);
        setSource({ boards: [] });
      });
  }, [widgetId]);

  const choose = async (gid: string | null) => {
    try {
      await savePin(widgetId, gid);
      const pick = await loadPick(widgetId);
      renderWidget(
        <BoardAndroidWidget view={viewAt(pinSource(source ?? { boards: [] }, gid), Date.now(), pick)} width={width} height={height} />,
      );
      setResult('ok');
    } catch (e) {
      console.warn('儲存小工具設定失敗', e);
      setResult('cancel');
    }
  };

  const boards = source?.boards ?? [];

  return (
    <View style={s.screen}>
      <Text style={s.title}>這個小工具要看哪個公布欄？</Text>
      {source === null ? (
        <ActivityIndicator color={C.mint} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          <Option label="全部公布欄" hint="用 ‹ › 切換，有人通報時自動跳過去" selected={pin === null} onPress={() => choose(null)} />
          {boards.map((b) => (
            <Option
              key={b.gid}
              label={b.groupName}
              hint="只看這個公布欄"
              selected={pin === b.gid}
              onPress={() => choose(b.gid)}
            />
          ))}
          {boards.length === 0 ? <Text style={s.empty}>還沒有公布欄資料：先打開 App 進入公布欄，再回來選。</Text> : null}
        </ScrollView>
      )}
      <Pressable onPress={() => setResult('cancel')} style={s.cancel} accessibilityRole="button">
        <Text style={s.cancelText}>取消</Text>
      </Pressable>
    </View>
  );
}

function Option({ label, hint, selected, onPress }: { label: string; hint: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.row, selected && s.rowSelected, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
      <Text style={[s.check, !selected && { opacity: 0 }]}>✓</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: 48, paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: C.ink, marginBottom: 16 },
  list: { gap: 10, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: { borderColor: C.lavender },
  label: { fontSize: 17, fontWeight: 'bold', color: C.ink },
  hint: { fontSize: 13, color: C.sub, marginTop: 2 },
  check: { fontSize: 20, fontWeight: 'bold', color: C.lavender, marginLeft: 8 },
  empty: { fontSize: 14, color: C.sub, marginTop: 8 },
  cancel: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { fontSize: 16, color: C.sub },
});
