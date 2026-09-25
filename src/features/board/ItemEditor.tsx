import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Label, Segmented } from '@/components/ui';
import { countdownLabel, whenLabel } from '@/lib/dates';
import { NOTE_COLORS, PRIORITY_META, type BoardItem, type Priority } from '@/lib/types';

import { DateTimeField } from './DateTimeField';
import { StatusPicker, TagPicker } from './Organize';

export type Draft = Pick<
  BoardItem,
  'type' | 'text' | 'color' | 'fontSize' | 'priority' | 'dueAt' | 'imageData' | 'status' | 'tags'
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
  draft: initial,
  isNew,
  tagSuggestions,
  onSave,
  onDelete,
  onClose,
}: {
  draft: Draft;
  isNew: boolean;
  /** 白板上大家用過的標籤 */
  tagSuggestions: string[];
  onSave: (draft: Draft) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const isImage = draft.type === 'image';

  const save = async () => {
    if (!isImage && !draft.text.trim()) return;
    setBusy(true);
    try {
      await onSave({ ...draft, text: draft.text.trim() });
      onClose();
    } catch (e) {
      // 失敗時留在編輯畫面，剛打的內容不會不見
      showError('儲存失敗', e);
    } finally {
      setBusy(false);
    }
  };

  const title = isNew ? (draft.priority !== 'none' ? '發布公告' : isImage ? '貼上圖片' : '新增便利貼') : '編輯';

  return (
    <Sheet
      visible
      title={title}
      onClose={onClose}
      footer={
        <>
          {onDelete ? <Button kind="soft" color={C.urgent} icon="trash-outline" label="刪除" onPress={onDelete} /> : null}
          <Button
            style={{ flex: 1 }}
            big
            label={isNew ? (draft.priority !== 'none' ? '發布，通知大家' : '貼到白板') : '儲存'}
            color={draft.priority !== 'none' ? PRIORITY_META[draft.priority].color : C.primary}
            onPress={save}
            busy={busy}
          />
        </>
      }>
      {isImage && draft.imageData ? (
        <Image source={{ uri: draft.imageData }} style={s.preview} contentFit="contain" />
      ) : null}

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
        <Label>日期時間（活動、截止日）</Label>
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
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
});
