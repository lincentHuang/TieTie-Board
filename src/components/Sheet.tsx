import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, Ionicons } from './ui';

/** 從下方滑出的面板（寬螢幕時置中） */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.grabber} />
          <View style={s.head}>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="關閉">
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>
          <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#3B2A5A66', justifyContent: 'flex-end', alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: C.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...(Platform.OS === 'web' ? { marginBottom: 'auto', marginTop: 'auto', borderRadius: 32 } : null),
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginTop: 10 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontFamily: F.display, color: C.ink },
  body: { paddingHorizontal: 20 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
});
