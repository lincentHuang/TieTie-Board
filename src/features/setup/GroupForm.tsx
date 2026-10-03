import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { Button, C, F, Label, Segmented } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { createGroup, joinGroup, normalizeCode } from '@/lib/repo';
import { useSession } from '@/lib/session';

/** 用邀請碼加入或建立新公布欄：第一次使用時要先取暱稱，之後新增公布欄沿用同一個暱稱 */
export function GroupForm({
  askNickname = false,
  title,
  onDone,
}: {
  askNickname?: boolean;
  title: string;
  /** 加入 / 建立成功後（例如關掉面板；輸入的剛好是目前這個公布欄時，畫面不會換，要靠這個收起來） */
  onDone?: () => void;
}) {
  const session = useSession();
  const [nickname, setNickname] = useState(session.nickname ?? '');
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const nick = nickname.trim();
    setBusy(true);
    setError(null);
    try {
      if (!nick) throw new Error('先告訴我你的暱稱吧');
      if (mode === 'create') {
        if (!groupName.trim()) throw new Error('請輸入群組名稱');
        const gid = await createGroup(groupName.trim(), session.uid, nick);
        await session.enterGroup(gid, nick);
      } else {
        const gid = normalizeCode(code);
        if (gid.length !== 6) throw new Error('邀請碼是 6 個字');
        if (!(await joinGroup(gid, session.uid, nick))) throw new Error('找不到這個邀請碼，再確認一次看看');
        await session.enterGroup(gid, nick);
      }
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      {askNickname ? (
        <>
          <Label>你的暱稱</Label>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="例：媽媽、小明、社長"
            placeholderTextColor="#B9B2CF"
            style={s.input}
          />
        </>
      ) : null}

      <Label>{title}</Label>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'join', label: '我有邀請碼' },
          { value: 'create', label: '建立新群組' },
        ]}
      />
      {mode === 'join' ? (
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="6 碼邀請碼"
          placeholderTextColor="#C9C2DD"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={[s.input, s.code]}
        />
      ) : (
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="群組名稱，例：黃家、登山社"
          placeholderTextColor="#B9B2CF"
          style={[s.input, { marginTop: 12 }]}
        />
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Button big style={{ marginTop: 24 }} label={mode === 'join' ? '加入群組' : '建立群組'} busy={busy} onPress={submit} />
    </>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 17,
    fontFamily: F.display,
    color: C.ink,
  },
  code: { marginTop: 12, fontSize: 30, letterSpacing: 8, textAlign: 'center', height: 68 },
  error: { color: C.urgent, marginTop: 12, fontSize: 15, fontFamily: F.display },
});
