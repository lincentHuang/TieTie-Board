import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { Button, C, F, Label, Segmented } from '@/components/ui';
import { canLoginWithGoogle } from '@/lib/firebase';
import { errorMessage } from '@/lib/errors';
import { joinBoard } from '@/lib/join';
import { canLoginWithLine } from '@/lib/liff';
import { createGroup, normalizeCode } from '@/lib/repo';
import { useSession } from '@/lib/session';

import { AccountCard } from './AccountCard';

/**
 * 用邀請碼加入或建立新公布欄：第一次使用時要先登入或取暱稱，之後新增公布欄沿用同一個名字。
 * 用 LINE / Google 登入的人不用取暱稱，直接用帳號的名字和頭像。
 */
export function GroupForm({
  askNickname = false,
  title,
  initialCode,
  onDone,
}: {
  askNickname?: boolean;
  title: string;
  /** 從邀請連結打開時先幫忙填好 */
  initialCode?: string;
  /** 加入 / 建立成功後（例如關掉面板；輸入的剛好是目前這個公布欄時，畫面不會換，要靠這個收起來） */
  onDone?: () => void;
}) {
  const session = useSession();
  const [nickname, setNickname] = useState(session.nickname ?? '');
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState(initialCode ?? '');
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const linked = session.account !== 'anonymous' && Boolean(session.nickname);
  const canSignIn = canLoginWithLine || canLoginWithGoogle();

  const submit = async () => {
    // 用帳號登入（可能是剛剛才按的）就用帳號的名字；沒問暱稱時（新增公布欄）沿用原本的名字
    const nick = (askNickname && !linked ? nickname : (session.nickname ?? '')).trim();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!nick) throw new Error('先告訴我你的暱稱吧');
      const profile = { name: nick, avatarUrl: session.avatarUrl };
      if (mode === 'create') {
        if (!groupName.trim()) throw new Error('請輸入群組名稱');
        const gid = await createGroup(groupName.trim(), session.uid, profile);
        await session.enterGroup(gid, nick);
      } else {
        const gid = normalizeCode(code);
        if (gid.length !== 6) throw new Error('邀請碼是 6 個字');
        const result = await joinBoard(gid, session.uid, profile);
        if (result === 'missing') throw new Error('找不到這個邀請碼，再確認一次看看');
        if (result === 'pending') {
          // 不關面板：申請會出現在「等房主同意」的清單裡
          await session.addPending(gid, nick);
          setCode('');
          setNotice('已送出加入申請，房主同意後就會自動加入');
          setBusy(false);
          return;
        }
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
      {askNickname ? <AccountCard /> : null}
      {askNickname && !linked ? (
        <>
          <Label>{canSignIn ? '或不登入，自己取個暱稱' : '你的暱稱'}</Label>
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
        <>
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
          <Text style={s.hint}>
            {canLoginWithLine ? '房主同意後就會加入（從 LINE 群組點邀請連結的家人不用等）' : '送出後，房主同意就會加入'}
          </Text>
        </>
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
      {notice ? <Text style={s.notice}>{notice}</Text> : null}

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
  hint: { color: C.sub, marginTop: 8, fontSize: 13, textAlign: 'center' },
  error: { color: C.urgent, marginTop: 12, fontSize: 15, fontFamily: F.display },
  notice: { color: C.ok, marginTop: 12, fontSize: 15, fontFamily: F.display },
});
