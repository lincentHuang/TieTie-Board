import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Label } from '@/components/ui';
import { canShareToLine, shareToLine } from '@/lib/liff';
import { lineInviteLink } from '@/lib/line';
import { approveJoinRequest, removeJoinRequest } from '@/lib/repo';
import type { JoinRequest, Member } from '@/lib/types';

/** 家人：誰還有公告沒看、邀請碼；房主還會看到想加入的人 */
export function InviteSheet({
  code,
  groupName,
  members,
  uid,
  ownerId,
  requests,
  unreadOf,
  onLeave,
  onClose,
}: {
  code: string;
  groupName: string;
  members: Member[];
  uid: string;
  ownerId: string;
  /** 等房主同意的加入申請（不是房主就是空的） */
  requests: JoinRequest[];
  unreadOf: (uid: string) => number;
  onLeave: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = lineInviteLink(code);
  const isOwner = ownerId === uid;
  const message = link
    ? `一起加入「${groupName}」公布欄！在 LINE 點這個連結，就會用你的 LINE 名字和頭像加入：\n${link}\n\n用「貼貼公布欄」App 的話，選「加入群組」輸入邀請碼：${code}`
    : `一起加入「${groupName}」公布欄！打開「貼貼公布欄」App 選「加入群組」，輸入邀請碼：${code}`;
  const hint = !link
    ? '請對方打開 App，選「加入群組」輸入這組邀請碼，房主同意後就能加入'
    : isOwner
      ? '貼到 LINE 群組：群組裡有公布欄的 LINE 官方帳號時，群組的人點連結就直接加入；其他人要等你同意'
      : '複製邀請訊息貼到 LINE 群組，家人點連結就能加入';
  const copy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
  };
  const share = () => shareToLine(message).catch((e) => showError('傳送失敗', e));
  const sorted = [...members].sort((a, b) => Number(b.uid === uid) - Number(a.uid === uid));

  return (
    <Sheet visible title="家人" onClose={onClose}>
      {requests.length > 0 ? <RequestList code={code} requests={requests} /> : null}

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
              {m.uid === ownerId ? <Text style={s.owner}>房主</Text> : null}
            </View>
          );
        })}
      </View>

      <Label>邀請家人加入</Label>
      <View style={s.codeBox}>
        <Text selectable style={s.code}>
          {code}
        </Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
      {canShareToLine() ? (
        <Button color={C.lineGreen} icon="chatbubble-ellipses" label="傳到 LINE 聊天室" onPress={share} style={{ marginTop: 10 }} />
      ) : null}
      <Button
        kind={canShareToLine() ? 'soft' : 'primary'}
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

/** 想加入的人（只有房主看得到）：同意就變成成員，不同意就刪掉申請（對方之後可以再申請） */
function RequestList({ code, requests }: { code: string; requests: JoinRequest[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (req: JoinRequest, approve: boolean) => {
    setBusy(req.uid);
    try {
      await (approve ? approveJoinRequest(code, req) : removeJoinRequest(code, req.uid));
    } catch (e) {
      showError(approve ? '同意失敗' : '操作失敗', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Label style={{ marginTop: 0 }}>想加入的人（{requests.length}）</Label>
      <View style={s.requests}>
        {requests.map((req) => (
          <View key={req.uid} style={s.request}>
            <MemberAvatar member={req} size={44} />
            <Text style={s.requestName} numberOfLines={1}>
              {req.name}
            </Text>
            <Button
              kind="ghost"
              color={C.sub}
              label="不同意"
              disabled={busy !== null}
              onPress={() => run(req, false)}
            />
            <Button
              color={C.ok}
              icon="checkmark"
              label="同意"
              busy={busy === req.uid}
              disabled={busy !== null}
              onPress={() => run(req, true)}
            />
          </View>
        ))}
      </View>
      <View style={{ height: 8 }} />
    </>
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
  owner: { fontSize: 11, color: C.primary, fontFamily: F.display },
  requests: { gap: 8 },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8EC',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFE2B8',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
  },
  requestName: { flex: 1, fontFamily: F.display, fontSize: 17, color: C.ink },
  codeBox: { backgroundColor: '#F4EEFF', borderRadius: 20, padding: 14, alignItems: 'center' },
  code: { fontFamily: F.display, fontSize: 40, letterSpacing: 8, color: C.ink },
  hint: { fontSize: 13, color: C.sub, marginTop: 4, textAlign: 'center' },
});
