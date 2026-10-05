import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { askConfirm } from '@/components/dialogs';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Ionicons, Label, Segmented, Squishy } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import {
  isFromPreset,
  MAX_ALERT_PRESETS,
  MAX_ALERT_TEXT,
  type AlertLevel,
  type AlertPreset,
  type QuickAlert,
} from '@/lib/types';

import { recallQuickAlert, sendQuickAlert } from './notify';
import { ALERT_EMOJIS, newPresetId } from './presets';
import { useAlertPresets } from './useAlertPresets';

type Mode = { kind: 'send' } | { kind: 'arrange' } | { kind: 'edit'; preset: AlertPreset; isNew: boolean };

/**
 * 快速通報：點一顆按鈕就送出，再點一下就收回；也可以自己打。
 * 按鈕可以自己新增、修改、刪除、調整順序（存在帳號上）
 */
export function QuickAlertSheet({
  gid,
  boardName,
  uid,
  nickname,
  sent,
  memberCount,
  onClose,
}: {
  gid: string;
  boardName: string;
  uid: string;
  nickname: string;
  /** 我在這個公布欄發的、還在時效內的通報（新的在前） */
  sent: QuickAlert[];
  memberCount: number;
  onClose: () => void;
}) {
  const { presets, custom: customized, save, reset } = useAlertPresets(uid);
  const [mode, setMode] = useState<Mode>({ kind: 'send' });
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(ALERT_EMOJIS[0]);
  const [level, setLevel] = useState<AlertLevel>('normal');
  /** 正在處理哪一個：send:按鈕 id、recall:通報 id、custom、save */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = presets ?? [];
  const custom = text.trim();
  const others = Math.max(memberCount - 1, 0);
  const ackedOf = (a: QuickAlert) => Object.keys(a.ackBy).filter((id) => id !== uid).length;
  const sentFor = (p: AlertPreset) => sent.find((a) => isFromPreset(a, p));
  // 自己打的、或按鈕後來改掉了：另外列出來，一樣可以收回
  const loose = sent.filter((a) => !list.some((p) => isFromPreset(a, p)));

  /** 失敗時保留打好的字、留在原本的畫面，讓使用者再按一次 */
  const run = async (key: string, job: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await job();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const send = (key: string, p: Pick<AlertPreset, 'emoji' | 'text' | 'level'>) =>
    run(key, () =>
      sendQuickAlert(gid, boardName, {
        emoji: p.emoji,
        text: p.text,
        level: p.level,
        authorId: uid,
        authorName: nickname.slice(0, 30),
      }),
    );

  const recall = (a: QuickAlert) => run(`recall:${a.id}`, () => recallQuickAlert(gid, a.id, uid));

  /** 按一下送出；已經送出（還在時效內）就收回 */
  const toggle = (p: AlertPreset) => {
    const a = sentFor(p);
    return a ? recall(a) : send(`send:${p.id}`, p);
  };

  const sendCustom = async () => {
    if (!custom || busy) return;
    if (await send('custom', { emoji, text: custom, level })) setText('');
  };

  const persist = async (next: AlertPreset[], after: Mode) => {
    if (await run('save', () => save(next))) setMode(after);
  };

  const saveCustomAsPreset = () =>
    persist([...list, { id: newPresetId(), emoji, text: custom, level }], { kind: 'send' });

  const resetPresets = async () => {
    if (!(await askConfirm('恢復預設的按鈕？', '自己新增、修改的按鈕都會不見。'))) return;
    await run('save', reset);
  };

  const arranging = mode.kind === 'arrange';

  // 新增 / 修改一顆按鈕：同一個面板換內容，不要關掉再打開
  if (mode.kind === 'edit') {
    const { preset, isNew } = mode;
    return (
      <Sheet visible title={isNew ? '新增按鈕' : '修改按鈕'} onClose={onClose}>
        <PresetForm
          key={preset.id}
          preset={preset}
          isNew={isNew}
          busy={busy === 'save'}
          error={error}
          onCancel={() => {
            setError(null);
            setMode({ kind: 'arrange' });
          }}
          onSave={(p) => persist(isNew ? [...list, p] : list.map((x) => (x.id === p.id ? p : x)), { kind: 'arrange' })}
          onDelete={isNew ? undefined : () => persist(list.filter((x) => x.id !== preset.id), { kind: 'arrange' })}
          onMoveFirst={
            isNew || list[0]?.id === preset.id
              ? undefined
              : () => persist([preset, ...list.filter((x) => x.id !== preset.id)], { kind: 'arrange' })
          }
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      visible
      title={arranging ? '編輯快速按鈕' : '📣 快速通報'}
      onClose={onClose}
      footer={
        arranging ? (
          <Button label="完成" big style={{ flex: 1 }} onPress={() => setMode({ kind: 'send' })} />
        ) : (
          <Button
            label="送出通報"
            icon="megaphone"
            big
            color={level === 'urgent' ? C.urgent : C.primary}
            style={{ flex: 1 }}
            disabled={!custom || busy !== null}
            busy={busy === 'custom'}
            onPress={sendCustom}
          />
        )
      }>
      <View style={s.hintRow}>
        <Text style={s.hint}>
          {arranging
            ? '點一顆按鈕修改內容、換表情或刪掉；也可以新增自己常用的句子。'
            : `點一下就送出：「${boardName}」每個人的手機都會跳通知。送錯了再點一下就收回。`}
        </Text>
        {arranging ? null : (
          <Pressable
            onPress={() => setMode({ kind: 'arrange' })}
            hitSlop={8}
            style={({ pressed }) => [s.editLink, pressed && { opacity: 0.6 }]}
            accessibilityLabel="編輯快速按鈕">
            <Ionicons name="create-outline" size={16} color={C.primary} />
            <Text style={s.editLinkText}>編輯按鈕</Text>
          </Pressable>
        )}
      </View>

      {presets === null ? (
        <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={s.grid}>
          {list.map((p) => {
            const a = arranging ? undefined : sentFor(p);
            return (
              <View key={p.id} style={s.presetCell}>
                <PresetTile
                  preset={p}
                  sent={a ? { acked: ackedOf(a), others } : null}
                  busy={busy === `send:${p.id}` || (a !== undefined && busy === `recall:${a.id}`)}
                  disabled={busy !== null}
                  arranging={arranging}
                  onPress={() => (arranging ? setMode({ kind: 'edit', preset: p, isNew: false }) : toggle(p))}
                />
              </View>
            );
          })}
          {arranging && list.length < MAX_ALERT_PRESETS ? (
            <View style={s.presetCell}>
              <Squishy
                onPress={() =>
                  setMode({ kind: 'edit', isNew: true, preset: { id: newPresetId(), emoji: ALERT_EMOJIS[0], text: '', level: 'normal' } })
                }
                style={[s.preset, s.presetAdd]}
                accessibilityLabel="新增按鈕">
                <Ionicons name="add-circle" size={28} color={C.primary} />
                <Text style={[s.presetText, { color: C.primary }]}>新增按鈕</Text>
              </Squishy>
            </View>
          ) : null}
        </View>
      )}

      {arranging ? (
        customized ? (
          <Pressable onPress={resetPresets} disabled={busy !== null} style={({ pressed }) => [s.reset, pressed && { opacity: 0.6 }]}>
            {busy === 'save' ? <ActivityIndicator color={C.sub} /> : <Text style={s.resetText}>恢復預設的按鈕</Text>}
          </Pressable>
        ) : null
      ) : (
        <>
          {loose.length ? (
            <>
              <Label>剛剛發出的</Label>
              <View style={{ gap: 8 }}>
                {loose.map((a) => (
                  <SentRow
                    key={a.id}
                    alert={a}
                    acked={ackedOf(a)}
                    others={others}
                    busy={busy === `recall:${a.id}`}
                    disabled={busy !== null}
                    onRecall={() => recall(a)}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Label>自己打</Label>
          <EmojiChoices value={emoji} onChange={setEmoji} />
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_ALERT_TEXT}
            placeholder="例：我在樓下，下來拿一下東西"
            placeholderTextColor="#B9B2CF"
            style={s.input}
            returnKeyType="send"
            onSubmitEditing={sendCustom}
          />
          <View style={{ marginTop: 10 }}>
            <Segmented
              value={level}
              onChange={setLevel}
              options={[
                { value: 'normal', label: '一般' },
                { value: 'urgent', label: '🚨 緊急', color: C.urgent },
              ]}
            />
          </View>
          {custom && list.length < MAX_ALERT_PRESETS && !list.some((p) => p.text === custom && p.emoji === emoji) ? (
            <Pressable
              onPress={saveCustomAsPreset}
              disabled={busy !== null}
              style={({ pressed }) => [s.saveAs, pressed && { opacity: 0.6 }]}
              accessibilityLabel="把這句存成快速按鈕">
              {busy === 'save' ? (
                <ActivityIndicator color={C.primary} />
              ) : (
                <>
                  <Ionicons name="bookmark-outline" size={15} color={C.primary} />
                  <Text style={s.saveAsText}>把這句存成按鈕，下次點一下就好</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </Sheet>
  );
}

/** 一顆快速通報按鈕：送出後變成「已通報」，再點一下收回；編輯時右上角有鉛筆 */
function PresetTile({
  preset,
  sent,
  busy,
  disabled,
  arranging,
  onPress,
}: {
  preset: AlertPreset;
  /** 已經送出、還在時效內：幾個人收到了 */
  sent: { acked: number; others: number } | null;
  busy: boolean;
  disabled: boolean;
  arranging: boolean;
  onPress: () => void;
}) {
  const urgent = preset.level === 'urgent';
  const fg = sent ? (urgent ? C.urgent : C.primary) : urgent ? '#FFF' : C.ink;
  return (
    // 外層負責排成兩欄、平均分寬度（Squishy 只會把 flex 類的樣式搬到外層）
    <Squishy
      onPress={onPress}
      disabled={disabled}
      style={[s.preset, urgent && s.presetUrgent, sent && s.presetSent, sent && urgent && s.presetSentUrgent]}
      accessibilityLabel={
        arranging ? `修改按鈕：${preset.text}` : sent ? `已通報：${preset.text}，再點一下收回` : `通報：${preset.text}`
      }>
      {busy ? (
        <ActivityIndicator color={urgent && !sent ? '#FFF' : C.primary} style={s.presetEmojiBox} />
      ) : (
        <Text style={s.presetEmoji}>{preset.emoji}</Text>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.presetText, { color: fg }]} numberOfLines={2}>
          {preset.text}
        </Text>
        {sent ? (
          <Text style={[s.sentText, { color: fg }]} numberOfLines={1}>
            再點一下收回
          </Text>
        ) : null}
      </View>
      {/* 已送出：右上角的勾勾，有其他人時順便顯示幾個人收到 */}
      {sent ? (
        <View style={[s.corner, { backgroundColor: urgent ? C.urgent : C.primary }]}>
          <Ionicons name="checkmark" size={12} color="#FFF" />
          {sent.others > 0 ? (
            <Text style={s.cornerText}>
              {sent.acked}/{sent.others}
            </Text>
          ) : null}
        </View>
      ) : null}
      {arranging ? (
        <View style={s.pencil}>
          <Ionicons name="pencil" size={13} color={urgent ? C.urgent : C.sub} />
        </View>
      ) : null}
    </Squishy>
  );
}

/** 自己打的通報（或按鈕已經改掉了）：顯示幾個人收到、可以收回 */
function SentRow({
  alert,
  acked,
  others,
  busy,
  disabled,
  onRecall,
}: {
  alert: QuickAlert;
  acked: number;
  others: number;
  busy: boolean;
  disabled: boolean;
  onRecall: () => void;
}) {
  return (
    <View style={[s.sentRow, alert.level === 'urgent' && { borderColor: C.urgent + '66' }]}>
      <Text style={s.presetEmoji}>{alert.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.presetText} numberOfLines={1}>
          {alert.text}
        </Text>
        <Text style={s.sentRowSub}>✓ 已通報{others > 0 ? `・${acked}/${others} 人收到` : ''}</Text>
      </View>
      <Button kind="soft" color={C.urgent} label="收回" icon="arrow-undo" busy={busy} disabled={disabled} onPress={onRecall} />
    </View>
  );
}

function EmojiChoices({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <View style={s.emojiRow}>
      {ALERT_EMOJIS.map((e) => (
        <Squishy
          key={e}
          onPress={() => onChange(e)}
          style={[s.emojiChip, e === value && s.emojiChipOn]}
          accessibilityLabel={`選擇 ${e}`}>
          <Text style={s.emojiChipText}>{e}</Text>
        </Squishy>
      ))}
    </View>
  );
}

/** 新增 / 修改一顆按鈕（放在快速通報面板裡） */
function PresetForm({
  preset,
  isNew,
  busy,
  error,
  onSave,
  onDelete,
  onMoveFirst,
  onCancel,
}: {
  preset: AlertPreset;
  isNew: boolean;
  busy: boolean;
  error: string | null;
  onSave: (p: AlertPreset) => void;
  onDelete?: () => void;
  onMoveFirst?: () => void;
  onCancel: () => void;
}) {
  const [emoji, setEmoji] = useState(preset.emoji);
  /** 自己輸入的表情（清單裡沒有的） */
  const [typed, setTyped] = useState(ALERT_EMOJIS.includes(preset.emoji) ? '' : preset.emoji);
  const [text, setText] = useState(preset.text);
  const [level, setLevel] = useState(preset.level);
  const trimmed = text.trim();
  const urgent = level === 'urgent';

  return (
    <>
      <Pressable onPress={onCancel} hitSlop={8} style={({ pressed }) => [s.back, pressed && { opacity: 0.6 }]}>
        <Ionicons name="chevron-back" size={18} color={C.sub} />
        <Text style={s.backText}>回到按鈕列表</Text>
      </Pressable>

      {/* 預覽：按鈕會長這樣 */}
      <View style={[s.preset, urgent && s.presetUrgent, s.previewTile]}>
        <Text style={s.presetEmoji}>{emoji}</Text>
        <Text style={[s.presetText, urgent && { color: '#FFF' }]} numberOfLines={2}>
          {trimmed || '按鈕上的字'}
        </Text>
      </View>

      <Label>表情</Label>
      <EmojiChoices
        value={emoji}
        onChange={(e) => {
          setEmoji(e);
          setTyped('');
        }}
      />
      <TextInput
        value={typed}
        onChangeText={(v) => {
          setTyped(v);
          if (v.trim()) setEmoji(v.trim());
        }}
        maxLength={8}
        placeholder="或自己輸入一個表情"
        placeholderTextColor="#B9B2CF"
        style={[s.input, s.emojiInput]}
        accessibilityLabel="自己輸入表情"
      />

      <Label>要通報的話</Label>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={MAX_ALERT_TEXT}
        placeholder="例：洗澡水放好了"
        placeholderTextColor="#B9B2CF"
        style={s.input}
        autoFocus={isNew}
      />
      <View style={{ marginTop: 10 }}>
        <Segmented
          value={level}
          onChange={setLevel}
          options={[
            { value: 'normal', label: '一般' },
            { value: 'urgent', label: '🚨 緊急', color: C.urgent },
          ]}
        />
      </View>

      {onMoveFirst ? (
        <Button kind="soft" color={C.lavender} icon="arrow-up" label="排到最前面" disabled={busy} onPress={onMoveFirst} style={{ marginTop: 14 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.formActions}>
        {onDelete ? (
          <Button kind="soft" big color={C.urgent} icon="trash-outline" label="刪除" disabled={busy} onPress={onDelete} />
        ) : null}
        <Button
          big
          style={{ flex: 1 }}
          label={isNew ? '加入' : '儲存'}
          color={urgent ? C.urgent : C.primary}
          disabled={!trimmed}
          busy={busy}
          onPress={() => onSave({ id: preset.id, emoji, text: trimmed, level })}
        />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  hint: { flex: 1, fontSize: 14, color: C.sub, lineHeight: 20 },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF0F6',
  },
  editLinkText: { fontFamily: F.display, fontSize: 13, color: C.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCell: { flexBasis: 150, flexGrow: 1 },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.line,
    borderBottomWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 64,
  },
  presetUrgent: { backgroundColor: C.urgent, borderColor: '#E84A5E' },
  // 已經送出：像按下去卡住的按鈕，換成淡色底＋粗框
  presetSent: { backgroundColor: '#FFF0F6', borderColor: C.primary, borderBottomWidth: 2, marginTop: 2 },
  presetSentUrgent: { backgroundColor: '#FFE8EB', borderColor: C.urgent },
  presetAdd: { borderStyle: 'dashed', borderBottomWidth: 2, backgroundColor: '#FFFAFC', justifyContent: 'center' },
  previewTile: { alignSelf: 'flex-start', minWidth: 180, marginBottom: 4 },
  presetEmoji: { fontSize: 26 },
  presetEmojiBox: { width: 32, height: 32 },
  presetText: { flexShrink: 1, fontFamily: F.display, fontSize: 16, color: C.ink },
  sentText: { fontFamily: F.display, fontSize: 11, marginTop: 2, opacity: 0.85 },
  corner: {
    position: 'absolute',
    top: -9,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 22,
    minWidth: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
  },
  cornerText: { fontFamily: F.display, fontSize: 11, color: '#FFF' },
  pencil: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reset: { alignSelf: 'center', marginTop: 16, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  resetText: { fontFamily: F.display, fontSize: 14, color: C.sub, textDecorationLine: 'underline' },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFC2D6',
    backgroundColor: '#FFF',
  },
  sentRowSub: { fontFamily: F.display, fontSize: 12, color: C.sub, marginTop: 2 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  emojiChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChipOn: { borderColor: C.primary, backgroundColor: '#FFF0F6' },
  emojiChipText: { fontSize: 20 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontFamily: F.display,
    color: C.ink,
  },
  emojiInput: { width: 200, paddingVertical: 8, fontSize: 15 },
  saveAs: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 12, height: 30 },
  saveAsText: { fontFamily: F.display, fontSize: 14, color: C.primary },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: 12, height: 28 },
  backText: { fontFamily: F.display, fontSize: 14, color: C.sub },
  error: { color: C.urgent, fontFamily: F.display, fontSize: 14, marginTop: 10 },
});
