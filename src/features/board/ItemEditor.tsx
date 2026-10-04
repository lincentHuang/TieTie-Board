import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Label, Segmented } from '@/components/ui';
import { FilePicker } from '@/features/files/FilePicker';
import type { PendingFiles } from '@/features/files/transfer';
import { countdownLabel, whenLabel } from '@/lib/dates';
import type { PickedFile } from '@/lib/documents';
import { MAX_FILES, MAX_PHOTOS, NOTE_COLORS, PRIORITY_META, type BoardItem, type Priority } from '@/lib/types';

import { DateTimeField } from './DateTimeField';
import { StatusPicker, TagPicker } from './Organize';
import { PhotoPicker } from './PhotoPicker';
import { PhotoViewer } from './PhotoViewer';

export type Draft = Pick<
  BoardItem,
  | 'type'
  | 'text'
  | 'color'
  | 'fontSize'
  | 'priority'
  | 'dueAt'
  | 'imageData'
  | 'photos'
  | 'carousel'
  | 'files'
  | 'status'
  | 'tags'
>;

const FONT_SIZES = [
  { value: '16', label: '小' },
  { value: '20', label: '中' },
  { value: '28', label: '大' },
  { value: '40', label: '特大' },
];

/** 預設活動時間：明天早上 9 點 */
const defaultDue = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
};

export function ItemEditor({
  gid,
  draft: initial,
  isNew,
  tagSuggestions,
  onSave,
  onDelete,
  onClose,
}: {
  /** 打開已經上傳的附件來看要用 */
  gid: string;
  draft: Draft;
  isNew: boolean;
  /** 白板上大家用過的標籤 */
  tagSuggestions: string[];
  /** uploads = 這次新加的檔案（要先上傳）；onProgress 收到上傳進度 0–1 */
  onSave: (draft: Draft, uploads: PickedFile[], onProgress: (ratio: number) => void) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  /** 新挑的檔案內容，按儲存才上傳 */
  const [pending, setPending] = useState<PendingFiles>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const isImage = draft.type === 'image';

  const save = async () => {
    // 便利貼至少要有文字、照片或檔案
    if (!isImage && !draft.text.trim() && !draft.photos.length && !draft.files.length) return;
    const uploads = draft.files.flatMap((file) => (pending[file.id] ? [{ file, bytes: pending[file.id] }] : []));
    setBusy(true);
    if (uploads.length) setProgress(0);
    try {
      await onSave({ ...draft, text: draft.text.trim() }, uploads, setProgress);
      onClose();
    } catch (e) {
      // 失敗時留在編輯畫面，剛打的內容、挑的檔案都不會不見
      showError('儲存失敗', e);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const saveLabel = isNew ? (draft.priority !== 'none' ? '發布，通知大家' : '貼到白板') : '儲存';

  const title = isNew ? (draft.priority !== 'none' ? '發布公告' : isImage ? '貼上圖片' : '新增便利貼') : '編輯';

  return (
    <Sheet
      visible
      title={title}
      onClose={onClose}
      footer={
        <>
          {onDelete ? <Button kind="soft" big color={C.urgent} icon="trash-outline" label="刪除" onPress={onDelete} /> : null}
          <Button
            style={{ flex: 1 }}
            big
            label={progress !== null ? `上傳檔案中 ${Math.round(progress * 100)}%` : saveLabel}
            color={draft.priority !== 'none' ? PRIORITY_META[draft.priority].color : C.primary}
            onPress={save}
            busy={busy && progress === null}
            disabled={busy}
          />
        </>
      }>
      {isImage && draft.imageData ? <Preview uri={draft.imageData} /> : null}

      <Label>{isImage ? '說明（選填）' : '內容（第一行會當作標題，顯示在桌面小工具）'}</Label>
      <TextInput
        value={draft.text}
        onChangeText={(text) => set({ text })}
        placeholder={isImage ? '例：畢業典禮大合照' : '例：週六 9:00 全家大掃除\n記得先把自己房間收好'}
        placeholderTextColor="#B9B2CF"
        multiline
        autoFocus={isNew && !isImage}
        style={[
          s.input,
          !isImage && { backgroundColor: draft.color, fontSize: Math.min(draft.fontSize, 28), minHeight: 120 },
        ]}
      />

      {!isImage ? (
        <>
          <Label>照片（選填，最多 {MAX_PHOTOS} 張）</Label>
          <PhotoPicker value={draft.photos} onChange={(photos) => set({ photos })} />
          {draft.photos.length > 1 ? (
            <>
              <View style={s.row}>
                <Label style={s.rowLabel}>在白板上輪播照片</Label>
                <Switch value={draft.carousel} onValueChange={(carousel) => set({ carousel })} />
              </View>
              <Text style={[s.hint, s.hintTight]}>
                {draft.carousel ? '白板上從封面開始，每幾秒換下一張。' : '白板上只放封面，點照片上的 ☆ 可以換。'}
                家人點兩下卡片就能看全部照片。
              </Text>
            </>
          ) : null}
          <Label>檔案（選填，最多 {MAX_FILES} 個）</Label>
          <FilePicker
            gid={gid}
            value={draft.files}
            pending={pending}
            onChange={(files, next) => {
              set({ files });
              setPending(next);
            }}
          />
          {draft.files.length ? <Text style={s.hint}>PDF 大家點一下就能直接看，其他檔案會下載下來用 Word 等 App 打開。</Text> : null}
          <Label>便利貼顏色</Label>
          <View style={s.colors}>
            {NOTE_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => set({ color: c })}
                style={[s.swatch, { backgroundColor: c }, draft.color === c && s.swatchActive]}
              />
            ))}
          </View>
          <Label>字體大小</Label>
          <Segmented
            value={String(draft.fontSize)}
            options={FONT_SIZES}
            onChange={(v) => set({ fontSize: Number(v) })}
          />
        </>
      ) : null}

      <Label>重要程度</Label>
      <Segmented<Priority>
        value={draft.priority}
        onChange={(priority) => set({ priority })}
        options={[
          { value: 'none', label: '一般' },
          { value: 'important', label: '📢 重要', color: PRIORITY_META.important.color },
          { value: 'urgent', label: '⚠️ 緊急', color: PRIORITY_META.urgent.color },
        ]}
      />
      <Text style={s.hint}>
        {draft.priority === 'none'
          ? '一般便利貼，不需要大家確認'
          : '會出現在每個人的桌面小工具上，直到對方按「我知道了」'}
      </Text>

      <View style={s.row}>
        <Label style={s.rowLabel}>日期時間（活動、截止日）</Label>
        <Switch value={draft.dueAt !== null} onValueChange={(on) => set({ dueAt: on ? defaultDue() : null })} />
      </View>
      {draft.dueAt !== null ? (
        <>
          <DateTimeField value={draft.dueAt} onChange={(dueAt) => set({ dueAt })} />
          <Text style={s.hint}>
            {whenLabel(draft.dueAt)}・{countdownLabel(draft.dueAt)}。小工具會倒數，並在前一天、前一小時、準時提醒。
          </Text>
        </>
      ) : null}

      <Label>狀態（當待辦事項用）</Label>
      <StatusPicker value={draft.status} onChange={(status) => set({ status })} />
      <Label>標籤</Label>
      <TagPicker value={draft.tags} suggestions={tagSuggestions} onChange={(tags) => set({ tags })} />
    </Sheet>
  );
}

/** 拍立得的預覽：點一下全螢幕放大看 */
function Preview({ uri }: { uri: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="放大看圖片">
        <Image source={{ uri }} style={s.preview} contentFit="contain" />
      </Pressable>
      {open ? <PhotoViewer photos={[uri]} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  preview: { width: '100%', height: 200, borderRadius: 18, backgroundColor: '#F4EEFF', marginTop: 4 },
  input: {
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 18,
    padding: 14,
    fontSize: 17,
    fontFamily: F.display,
    color: C.ink,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  colors: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: C.line },
  swatchActive: { borderWidth: 4, borderColor: C.primary },
  hint: { fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 18 },
  hintTight: { marginTop: 0 },
  // 標題的上下間距移到整排上，開關才會跟文字置中對齊
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, marginBottom: 8 },
  rowLabel: { marginTop: 0, marginBottom: 0, flexShrink: 1 },
});
