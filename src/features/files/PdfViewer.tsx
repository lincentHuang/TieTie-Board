import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showError } from '@/components/dialogs';
import { Button, C, F, Ionicons, themed } from '@/components/ui';
import { OPEN_EXTERNALLY_LABEL, openExternally } from '@/lib/files';
import type { Attachment } from '@/lib/types';

import { PdfFrame } from './PdfFrame';
import type { PdfErrorReason, PdfStatus } from './pdf-viewer-html';

/** 這麼久還沒打開，多半是網路卡住了，先給使用者「下載」這條路 */
const SLOW_MS = 30_000;

const ERRORS: Record<PdfErrorReason | 'slow', string> = {
  password: '這個 PDF 有密碼保護，請下載後用其他 App 打開',
  invalid: '檔案好像壞掉了，或不是 PDF',
  network: '連不上 PDF 檢視器，請檢查網路後再試一次',
  unknown: '這個 PDF 打不開',
  slow: '打開得有點久…網路慢的話可以先下載來看',
};

/** 全螢幕看 PDF：上下捲動翻頁，兩指或點兩下放大；右上角可以下載 / 用其他 App 打開 */
export function PdfViewer({ file, bytes, onClose }: { file: Attachment; bytes: Uint8Array<ArrayBuffer>; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PdfStatus | { type: 'loading' | 'slow' }>({ type: 'loading' });
  const loading = status.type === 'loading' || status.type === 'slow';

  useEffect(() => {
    const timer = setTimeout(() => setStatus((s) => (s.type === 'loading' ? { type: 'slow' } : s)), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  const share = () => openExternally(file, bytes).catch((e) => showError('打不開檔案', e));
  const message = status.type === 'error' ? ERRORS[status.reason] : status.type === 'slow' ? ERRORS.slow : null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={s.iconBtn} accessibilityLabel="關閉">
            <Ionicons name="chevron-down" size={24} color={C.ink} />
          </Pressable>
          <View style={s.titleBox}>
            <Text style={s.title} numberOfLines={1}>
              {file.name}
            </Text>
            {status.type === 'loaded' ? <Text style={s.sub}>共 {status.pages} 頁</Text> : null}
          </View>
          <Pressable onPress={share} hitSlop={10} style={s.iconBtn} accessibilityLabel={OPEN_EXTERNALLY_LABEL}>
            <Ionicons name="download-outline" size={22} color={C.ink} />
          </Pressable>
        </View>

        <View style={s.body}>
          <PdfFrame bytes={bytes} onStatus={setStatus} />
          {loading || message ? (
            <View style={s.overlay} pointerEvents={status.type === 'loading' ? 'none' : 'auto'}>
              {loading ? <ActivityIndicator size="large" color={C.primary} /> : null}
              <Text style={s.overlayText}>{message ?? '正在打開 PDF…'}</Text>
              {message ? <Button icon="download-outline" label={OPEN_EXTERNALLY_LABEL} onPress={share} /> : null}
            </View>
          ) : null}
        </View>
        <View style={{ height: insets.bottom, backgroundColor: '#ECE6F6' }} />
      </View>
    </Modal>
  );
}

const s = themed(() => ({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: C.bg,
    borderBottomWidth: 2,
    borderBottomColor: C.line,
  },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  titleBox: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontFamily: F.display, color: C.ink },
  sub: { fontSize: 12, fontFamily: F.display, color: C.sub, marginTop: 1 },
  body: { flex: 1, backgroundColor: '#ECE6F6' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
    backgroundColor: '#ECE6F6E6',
  },
  overlayText: { fontSize: 16, fontFamily: F.display, color: C.ink, textAlign: 'center', lineHeight: 24 },
}));
