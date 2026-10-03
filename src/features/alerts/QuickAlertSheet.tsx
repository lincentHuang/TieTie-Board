import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, C, F, Label, Segmented, Squishy } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { MAX_ALERT_TEXT, type AlertLevel } from '@/lib/types';

import { sendQuickAlert } from './notify';
import { ALERT_EMOJIS, ALERT_PRESETS } from './presets';

type Preset = { emoji: string; text: string; level: AlertLevel };

/** 快速通報：點一個常用句子就送出，也可以自己打 */
export function QuickAlertSheet({
  gid,
  boardName,
  uid,
  nickname,
  onClose,
}: {
  gid: string;
  boardName: string;
  uid: string;
  nickname: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(ALERT_EMOJIS[0]);
  const [level, setLevel] = useState<AlertLevel>('normal');
  /** 正在送出的是哪一個（常用句子的文字，或 'custom'） */
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (key: string, preset: Preset) => {
    setSending(key);
    setError(null);
    try {
      await sendQuickAlert(gid, boardName, { ...preset, authorId: uid, authorName: nickname.slice(0, 30) });
      onClose();
    } catch (e) {
      // 失敗時保留打好的字，讓使用者再按一次
      setError(errorMessage(e));
      setSending(null);
    }
  };

  const custom = text.trim();

  return (
    <Sheet
      visible
      title="📣 快速通報"
      onClose={onClose}
      footer={
        <Button
          label="送出通報"
          icon="megaphone"
          big
          color={level === 'urgent' ? C.urgent : C.primary}
          style={{ flex: 1 }}
          disabled={!custom || sending !== null}
          busy={sending === 'custom'}
          onPress={() => send('custom', { emoji, text: custom, level })}
        />
      }>
      <Text style={s.hint}>
        按一下就送出：「{boardName}」每個人的手機都會跳通知，桌面小工具也會馬上變色提醒。
      </Text>

      <View style={s.grid}>
        {ALERT_PRESETS.map((p) => {
          const urgent = p.level === 'urgent';
          return (
            // 外層負責排成兩欄、平均分寬度（Squishy 只會把 flex 類的樣式搬到外層）
            <View key={p.text} style={s.presetCell}>
              <Squishy
                onPress={() => send(p.text, p)}
                disabled={sending !== null}
                style={[s.preset, urgent && s.presetUrgent]}
                accessibilityLabel={`通報：${p.text}`}>
                {sending === p.text ? (
                  <ActivityIndicator color={urgent ? '#FFF' : C.primary} style={s.presetEmojiBox} />
                ) : (
                  <Text style={s.presetEmoji}>{p.emoji}</Text>
                )}
                <Text style={[s.presetText, urgent && { color: '#FFF' }]} numberOfLines={2}>
                  {p.text}
                </Text>
              </Squishy>
            </View>
          );
        })}
      </View>

      <Label>自己打</Label>
      <View style={s.emojiRow}>
        {ALERT_EMOJIS.map((e) => (
          <Squishy
            key={e}
            onPress={() => setEmoji(e)}
            style={[s.emojiChip, e === emoji && s.emojiChipOn]}
            accessibilityLabel={`選擇 ${e}`}>
            <Text style={s.emojiChipText}>{e}</Text>
          </Squishy>
        ))}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={MAX_ALERT_TEXT}
        placeholder="例：我在樓下，下來拿一下東西"
        placeholderTextColor="#B9B2CF"
        style={s.input}
        returnKeyType="send"
        onSubmitEditing={() => custom && sending === null && send('custom', { emoji, text: custom, level })}
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
      {error ? <Text style={s.error}>{error}</Text> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: 14, color: C.sub, lineHeight: 20, marginBottom: 12 },
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
  },
  presetUrgent: { backgroundColor: C.urgent, borderColor: '#E84A5E' },
  presetEmoji: { fontSize: 26 },
  presetEmojiBox: { width: 32, height: 32 },
  presetText: { flex: 1, fontFamily: F.display, fontSize: 16, color: C.ink },
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
  error: { color: C.urgent, fontFamily: F.display, fontSize: 14, marginTop: 10 },
});
