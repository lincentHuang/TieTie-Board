import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MemberAvatar } from '@/components/MemberAvatar';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Label } from '@/components/ui';
import type { Member } from '@/lib/types';

/** 家人：誰還有公告沒看、邀請碼 */
export function InviteSheet({
  code,
  groupName,
  members,
  uid,
  unreadOf,
  onLeave,
  onClose,
}: {
  code: string;
  groupName: string;
  members: Member[];
  uid: string;
  unreadOf: (uid: string) => number;
  onLeave: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(`一起加入「${groupName}」公布欄！打開「貼貼公布欄」App 選「加入群組」，輸入邀請碼：${code}`);
    setCopied(true);
  };
  const sorted = [...members].sort((a, b) => Number(b.uid === uid) - Number(a.uid === uid));

  return (
    <Sheet visible title="家人" onClose={onClose}>
      <View style={s.grid}>
        {sorted.map((m) => {
          const unread = unreadOf(m.uid);
          return (
            <View key={m.uid} style={[s.card, m.uid === uid && s.cardMe]}>
              <MemberAvatar member={m} size={56} />
              <Text style={s.name} numberOfLines={1}>
                {m.name}
                {m.uid === uid ? '（我）' : ''}
              </Text>
              <Text style={[s.status, unread > 0 && { color: C.urgent }]} numberOfLines={1}>
                {unread > 0 ? `還有 ${unread} 則沒看` : '都看過了 ✓'}
              </Text>
            </View>
          );
        })}
      </View>

      <Label>邀請家人加入</Label>
      <View style={s.codeBox}>
        <Text selectable style={s.code}>
          {code}
        </Text>
        <Text style={s.hint}>請對方打開 App，選「加入群組」輸入這組邀請碼</Text>
      </View>
      <Button
        icon={copied ? 'checkmark' : 'copy-outline'}
        label={copied ? '已複製，可以貼到 LINE' : '複製邀請訊息'}
        onPress={copy}
        style={{ marginTop: 10 }}
      />

      <View style={{ height: 20 }} />
      <Button kind="ghost" color={C.urgent} icon="exit-outline" label="離開這個群組" onPress={onLeave} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: 108,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.line,
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 2,
  },
  cardMe: { borderColor: '#FFC2D6', backgroundColor: '#FFF7FA' },
  name: { fontFamily: F.display, fontSize: 15, color: C.ink, marginTop: 4 },
  status: { fontSize: 11, color: C.ok, marginTop: 3 },
  codeBox: { backgroundColor: '#F4EEFF', borderRadius: 20, padding: 14, alignItems: 'center' },
  code: { fontFamily: F.display, fontSize: 40, letterSpacing: 8, color: C.ink },
  hint: { fontSize: 13, color: C.sub, marginTop: 4 },
});
