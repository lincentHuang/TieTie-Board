import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { C, F, Ionicons, Squishy, themed } from '@/components/ui';
import { pickDocuments } from '@/lib/documents';
import { MAX_FILE_BYTES, MAX_FILES, fileSizeLabel, type Attachment } from '@/lib/types';

import { FileRow } from './FileRow';
import type { PendingFiles } from './transfer';

/** 編輯時的附件清單：點一下打開來看、按 ✕ 拿掉，最下面可以再加（新檔案按儲存時才上傳） */
export function FilePicker({
  gid,
  value,
  pending,
  onChange,
}: {
  gid: string;
  value: Attachment[];
  pending: PendingFiles;
  onChange: (files: Attachment[], pending: PendingFiles) => void;
}) {
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const { accepted, tooBig } = await pickDocuments(MAX_FILES - value.length);
      if (accepted.length) {
        const next = { ...pending };
        for (const p of accepted) next[p.file.id] = p.bytes;
        onChange([...value, ...accepted.map((p) => p.file)], next);
      }
      if (tooBig.length) {
        showError(
          '有檔案太大了',
          new Error(`${tooBig.join('、')}\n每個檔案最多 ${fileSizeLabel(MAX_FILE_BYTES)}，大檔案可以放雲端硬碟，把連結貼在內容裡`),
        );
      }
    } catch (e) {
      showError('無法讀取檔案', e);
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    const { [id]: _removed, ...rest } = pending;
    onChange(
      value.filter((f) => f.id !== id),
      rest,
    );
  };

  return (
    <View style={s.list}>
      {value.map((f) => (
        <FileRow key={f.id} gid={gid} file={f} local={pending[f.id]} onRemove={() => remove(f.id)} />
      ))}
      {value.length < MAX_FILES ? (
        <Squishy onPress={add} disabled={busy} style={s.add} accessibilityLabel="加檔案">
          {busy ? (
            <ActivityIndicator color={C.lavender} />
          ) : (
            <>
              <Ionicons name="attach" size={22} color={C.lavender} />
              <Text style={s.addText}>加檔案（PDF、Word、Excel…）</Text>
            </>
          )}
        </Squishy>
      ) : null}
    </View>
  );
}

const s = themed(() => ({
  list: { gap: 8 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.lavender,
    backgroundColor: C.lavender + '14',
  },
  addText: { fontSize: 14, fontFamily: F.display, color: C.lavender },
}));
