import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F } from '@/components/ui';

import { GroupForm } from './GroupForm';

/** 第一次使用：取暱稱，然後建立或加入群組 */
export function SetupScreen() {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>貼貼公布欄</Text>
        <Text style={s.tagline}>家人、社團的重要事，一個都不漏</Text>

        <GroupForm askNickname title="要加入家人的公布欄，還是開一個新的？" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontSize: 44, fontFamily: F.display, textAlign: 'center', color: C.primary },
  tagline: { fontSize: 15, fontFamily: F.display, textAlign: 'center', color: C.sub, marginTop: 2, marginBottom: 4 },
});
