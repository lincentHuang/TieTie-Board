import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { C, F, Ionicons } from '@/components/ui';
import { OPEN_EXTERNALLY_LABEL, openExternally } from '@/lib/files';
import { fileSizeLabel, isPdf, type Attachment } from '@/lib/types';

import { fileKind } from './file-kinds';
import { PdfViewer } from './PdfViewer';
import { loadFile } from './transfer';

/**
 * 一個附件：點了 PDF 直接打開來看，其他檔案下載 / 交給其他 App 打開。
 * local = 還沒上傳的新檔案（編輯中），直接用手上的內容
 */
export function FileRow({
  gid,
  file,
  local,
  onRemove,
}: {
  gid: string;
  file: Attachment;
  local?: Uint8Array<ArrayBuffer>;
  /** 有給才顯示 ✕（編輯時） */
  onRemove?: () => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const kind = fileKind(file);
  const pdf = isPdf(file);

  const open = async () => {
    if (progress !== null) return;
    setProgress(0);
    try {
      const bytes = local ?? (await loadFile(gid, file, setProgress));
      if (pdf) setViewing(bytes);
      else await openExternally(file, bytes);
    } catch (e) {
      showError('打不開檔案', e);
    } finally {
      setProgress(null);
    }
  };

  const action = pdf ? '點一下打開來看' : `點一下${OPEN_EXTERNALLY_LABEL}`;

  return (
    <>
      <Pressable onPress={open} style={s.row} accessibilityLabel={`${file.name}，${action}`}>
        <View style={[s.icon, { backgroundColor: kind.color + '1F' }]}>
          <Ionicons name={kind.icon} size={20} color={kind.color} />
          <Text style={[s.kind, { color: kind.color }]} numberOfLines={1}>
            {kind.label}
          </Text>
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={2}>
            {file.name}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {progress !== null
              ? progress > 0
                ? `下載中 ${Math.round(progress * 100)}%`
                : '準備中…'
              : `${fileSizeLabel(file.size)}・${local ? '還沒上傳，儲存時一起傳' : action}`}
          </Text>
        </View>
        {progress !== null ? (
          <ActivityIndicator color={kind.color} />
        ) : (
          <Ionicons name={pdf ? 'eye-outline' : 'download-outline'} size={20} color={C.sub} />
        )}
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={8} style={s.remove} accessibilityLabel={`拿掉 ${file.name}`}>
            <Ionicons name="close" size={16} color={C.sub} />
          </Pressable>
        ) : null}
      </Pressable>
      {viewing ? <PdfViewer file={file} bytes={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: '#FFF',
  },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 9, fontFamily: F.display, marginTop: -1 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: F.display, color: C.ink },
  meta: { fontSize: 12, fontFamily: F.display, color: C.sub },
  remove: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' },
});
