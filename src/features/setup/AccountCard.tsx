import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MemberAvatar } from '@/components/MemberAvatar';
import { Button, C, F } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { canLoginWithGoogle } from '@/lib/firebase';
import { canLoginWithLine, loginWithLine } from '@/lib/liff';
import { useSession } from '@/lib/session';

const VIA = { line: 'LINE', google: 'Google' };

/**
 * 登入方式：LINE 為主（家庭群組點進來最順），Google 當備案（在電腦上看、沒有 LINE 的人）。
 * 已經登入就顯示目前的身分；兩種都不能用時（例如手機 App 版）只在有 anonymousNote 時顯示名字，不然什麼都不顯示。
 */
export function AccountCard({
  hint,
  anonymousNote,
  style,
}: {
  hint?: string;
  /** 不能登入時，名字下面的說明（例如設定裡的「我的帳號」） */
  anonymousNote?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const session = useSession();
  const [busy, setBusy] = useState<'line' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const google = canLoginWithGoogle();
  const canLogin = canLoginWithLine || google;
  const note = session.account !== 'anonymous' ? `已用 ${VIA[session.account]} 登入，名字和頭像會跟著帳號` : canLogin ? null : anonymousNote;
  if (note && session.nickname) {
    return (
      <View style={[s.me, style]}>
        <MemberAvatar member={{ uid: session.uid, name: session.nickname, avatarUrl: session.avatarUrl }} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.meName} numberOfLines={1}>
            {session.nickname}
          </Text>
          <Text style={s.meHint}>{note}</Text>
        </View>
      </View>
    );
  }
  if (!canLogin) return null;

  // 要在 onPress 裡直接開始登入（中間不能先 await），Google 的彈出視窗才不會被瀏覽器擋下
  const run = (kind: 'line' | 'google', login: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    login()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  return (
    <View style={[s.options, style]}>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {canLoginWithLine ? (
        <Button
          color={C.lineGreen}
          icon="chatbubble-ellipses"
          label="用 LINE 登入"
          busy={busy === 'line'}
          onPress={() => run('line', loginWithLine)}
        />
      ) : null}
      {google ? (
        <Button
          kind="soft"
          color={C.ink}
          icon="logo-google"
          label={canLoginWithLine ? '沒有 LINE？用 Google 登入' : '用 Google 登入'}
          busy={busy === 'google'}
          onPress={() => run('google', session.loginWithGoogle)}
        />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  options: { gap: 10, marginTop: 16 },
  hint: { fontSize: 13, color: C.sub, textAlign: 'center' },
  error: { color: C.urgent, fontSize: 14, fontFamily: F.display },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.line,
    padding: 12,
  },
  meName: { fontFamily: F.display, fontSize: 18, color: C.ink },
  meHint: { fontSize: 13, color: C.sub, marginTop: 2 },
});
