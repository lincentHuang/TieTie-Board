import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Sheet } from '@/components/Sheet';
import { RichText } from '@/components/RichText';
import { Button, C, F, Ionicons, Label, Segmented, type IconName } from '@/components/ui';
import { FilePicker } from '@/features/files/FilePicker';
import type { PendingFiles } from '@/features/files/transfer';
import { countdownLabel, whenLabel } from '@/lib/dates';
import type { PickedFile } from '@/lib/documents';
import { hasFormatting, insertLink, safeUrl, toggleHeading, wrapSelection, type Selection } from '@/lib/rich-text';
import { MAX_FILES, MAX_PHOTOS, NOTE_COLORS, PRIORITY_META, type BoardItem, type Priority } from '@/lib/types';

import { ChecklistEditor } from './ChecklistEditor';
import { applyWhen, parseWhen } from './parse-when';
import { DateTimeField } from './DateTimeField';
import { StatusPicker, TagPicker } from './Organize';
import { PhotoPicker } from './PhotoPicker';
import { PhotoViewer } from './PhotoViewer';
import { cleanTasks } from './todos';

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
  | 'tasks'
  | 'status'
  | 'tags'
>;

const FONT_SIZES = [
  { value: '16', label: '小' },
  { value: '20', label: '中' },
  { value: '28', label: '大' },
  { value: '40', label: '特大' },
];

/** 現在幾點（只在打字時叫） */
const clock = () => Date.now();

/** 預設日期：今天，下一個整點（太晚就今天 23:00） */
export const defaultDue = (now = Date.now()) => {
  const d = new Date(now);
  d.setHours(Math.min(23, d.getHours() + 1), 0, 0, 0);
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
  /** 從工具列的「待辦」新增的：清單是主角，文字只是清單名稱 */
  const listFirst = isNew && initial.tasks.length > 0;
  /** 公告：日期放在內容下面第二行，一打開就看得到、改得到（照打開時決定，改重要程度時不會跳位置） */
  const dateFirst = initial.priority !== 'none' && initial.type !== 'image';
  /** 新增時：內容裡寫了日期時間就自動帶到日期欄；自己動過日期欄之後就不再改 */
  const [autoDate, setAutoDate] = useState(isNew);
  const [autoFound, setAutoFound] = useState(false);
  const changeText = (text: string) => {
    const found = autoDate ? parseWhen(text, clock()) : null;
    // 每次都從打開時的日期重新套；內容裡的日期時間刪掉了，日期欄也回到打開時的樣子
    if (found) set({ text, dueAt: applyWhen(found, initial.dueAt, defaultDue()) });
    else set(autoFound ? { text, dueAt: initial.dueAt } : { text });
    if (autoDate) setAutoFound(found !== null);
  };
  const changeDue = (dueAt: number | null) => {
    setAutoDate(false);
    setAutoFound(false);
    set({ dueAt });
  };

  const save = async () => {
    const tasks = cleanTasks(draft.tasks);
    // 便利貼至少要有文字、待辦、照片或檔案
    if (!isImage && !draft.text.trim() && !tasks.length && !draft.photos.length && !draft.files.length) return;
    const uploads = draft.files.flatMap((file) => (pending[file.id] ? [{ file, bytes: pending[file.id] }] : []));
    setBusy(true);
    if (uploads.length) setProgress(0);
    try {
      await onSave({ ...draft, text: draft.text.trim(), tasks }, uploads, setProgress);
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

  const title = isNew
    ? draft.priority !== 'none'
      ? '發布公告'
      : isImage
        ? '貼上圖片'
        : listFirst
          ? '新增待辦清單'
          : '新增便利貼'
    : '編輯';

  const dateField = (
    <>
      <View style={s.row}>
        <Label style={s.rowLabel}>日期時間（活動、截止日）</Label>
        <Switch value={draft.dueAt !== null} onValueChange={(on) => changeDue(on ? defaultDue() : null)} />
      </View>
      {draft.dueAt !== null ? (
        <>
          <DateTimeField value={draft.dueAt} onChange={changeDue} />
          <Text style={s.hint}>
            {autoFound ? '✨ 從內容自動帶入：' : ''}
          {whenLabel(draft.dueAt)}・{countdownLabel(draft.dueAt)}。小工具會倒數，並在前一天、前一小時、準時提醒。
          </Text>
        </>
      ) : null}
    </>
  );

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

      {isImage ? (
        <>
          <Label>說明（選填）</Label>
          <TextInput
            value={draft.text}
            onChangeText={(text) => set({ text })}
            placeholder="例：畢業典禮大合照"
            placeholderTextColor="#B9B2CF"
            multiline
            style={s.input}
          />
        </>
      ) : (
        <>
          <NoteText draft={draft} autoFocus={isNew && !listFirst} listFirst={listFirst} onChange={changeText} />
          {dateFirst ? dateField : null}
          <ChecklistEditor tasks={draft.tasks} focusFirst={listFirst} onChange={(tasks) => set({ tasks })} />
        </>
      )}

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

      {dateFirst ? null : dateField}

      <Label>狀態（當待辦事項用）</Label>
      <StatusPicker value={draft.status} onChange={(status) => set({ status })} />
      <Label>標籤</Label>
      <TagPicker value={draft.tags} suggestions={tagSuggestions} onChange={(tags) => set({ tags })} />
    </Sheet>
  );
}

/** 便利貼內容：上面一排按鈕把選到的字標成標題、重點、連結，下面預覽排出來的樣子 */
function NoteText({
  draft,
  autoFocus,
  listFirst,
  onChange,
}: {
  draft: Draft;
  autoFocus: boolean;
  /** 待辦清單：這格只是清單名稱，矮一點 */
  listFirst: boolean;
  onChange: (text: string) => void;
}) {
  const text = draft.text;
  const [rawSel, setSel] = useState<Selection>({ start: text.length, end: text.length });
  /** 網頁版打字時不一定會回報游標位置，記下的位置可能超過現在的內容，先校正 */
  const sel = {
    start: Math.min(rawSel.start, rawSel.end, text.length),
    end: Math.min(Math.max(rawSel.start, rawSel.end), text.length),
  };
  /** 按了按鈕之後要把游標 / 選取放到哪裡；輸入框回報新位置後就放手 */
  const [forced, setForced] = useState<Selection | undefined>();
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');

  const apply = (next: { text: string; sel: Selection }) => {
    onChange(next.text);
    setSel(next.sel);
    setForced(next.sel);
  };
  const addLink = () => {
    const safe = safeUrl(url.trim());
    if (!safe) return showError('網址怪怪的', new Error('請貼上 https:// 開頭的網址'));
    apply(insertLink(text, sel, safe));
    setUrl('');
    setLinking(false);
  };
  const picked = sel.end > sel.start;

  return (
    <>
      <Label>{listFirst ? '清單名稱（選填）' : '內容'}</Label>
      {/* 清單名稱只是一行字，不用格式按鈕（之後按「編輯」還是可以加） */}
      {listFirst ? null : (
        <View style={s.tools}>
          <Tool icon="text" label="標題" onPress={() => apply(toggleHeading(text, sel))} />
          <Tool icon="color-wand" label="重點" onPress={() => apply(wrapSelection(text, sel, '**', '**', '重點'))} />
          <Tool icon="link" label="連結" active={linking} onPress={() => setLinking((v) => !v)} />
        </View>
      )}
      {linking ? (
        <View style={s.linkRow}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="貼上網址 https://…"
            placeholderTextColor="#B9B2CF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            onSubmitEditing={addLink}
            style={[s.input, s.linkInput]}
          />
          <Button label="加入" onPress={addLink} disabled={!url.trim()} />
        </View>
      ) : null}
      <TextInput
        value={text}
        onChangeText={onChange}
        selection={forced}
        onSelectionChange={(e) => {
          setSel(e.nativeEvent.selection);
          setForced(undefined);
        }}
        placeholder={listFirst ? '例：週末採買' : '例：週六 9:00 全家大掃除\n記得先把自己房間收好'}
        placeholderTextColor="#B9B2CF"
        multiline
        autoFocus={autoFocus && !linking}
        style={[s.input, { backgroundColor: draft.color, fontSize: Math.min(draft.fontSize, 28), minHeight: listFirst ? 60 : 120 }]}
      />
      <Text style={s.hint}>
        {listFirst
          ? '會顯示在卡片最上面；不寫的話就叫「待辦清單」。'
          : linking
          ? picked
            ? '選到的字會變成連結，大家點一下就打開網址。'
            : '沒選字的話直接放網址；先選字再按「加入」，那幾個字就會變成連結。'
          : '先選字再按按鈕。標題會顯示在桌面小工具和通知上；沒設標題就用第一行。直接貼的網址也點得開。'}
      </Text>
      {hasFormatting(text) ? (
        <>
          <Label>預覽</Label>
          <View style={[s.preview2, { backgroundColor: draft.color }]}>
            <RichText linkable text={text} fontSize={Math.min(draft.fontSize, 28)} lineHeight={Math.min(draft.fontSize, 28) * 1.35} style={s.previewText} />
          </View>
        </>
      ) : null}
    </>
  );
}

function Tool({ icon, label, active, onPress }: { icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`標成${label}`}
      style={({ pressed }) => [s.tool, (active || pressed) && s.toolOn]}>
      <Ionicons name={icon} size={16} color={active ? '#FFF' : C.ink} />
      <Text style={[s.toolText, active && { color: '#FFF' }]}>{label}</Text>
    </Pressable>
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
  tools: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  toolOn: { backgroundColor: C.sky, borderColor: C.sky },
  toolText: { fontSize: 14, fontFamily: F.display, color: C.ink },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  linkInput: { flex: 1, minHeight: 0, paddingVertical: 10 },
  preview2: { borderRadius: 18, padding: 14, borderWidth: 2, borderColor: C.line },
  previewText: { fontFamily: F.display, color: C.ink },
  // 標題的上下間距移到整排上，開關才會跟文字置中對齊
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, marginBottom: 8 },
  rowLabel: { marginTop: 0, marginBottom: 0, flexShrink: 1 },
});
