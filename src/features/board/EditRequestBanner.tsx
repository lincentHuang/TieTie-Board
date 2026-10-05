import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Button, C, F } from '@/components/ui';
import { notifyPerson } from '@/features/alerts/notify';
import { approveEditRequest, removeEditRequest } from '@/lib/repo';
import { itemTitle, type BoardItem, type EditRequest } from '@/lib/types';

/** 有人想改我貼的東西（先送出的在前）：同意後對方就能一直改那一張，點文字可以在白板上找到它 */
export function EditRequestBanner({
  gid,
  boardName,
  myName,
  requests,
  items,
  onLocate,
}: {
  gid: string;
  boardName: string;
  /** 我的名字：同意後通知對方「誰同意了」 */
  myName: string;
  requests: EditRequest[];
  items: BoardItem[];
  onLocate: (item: BoardItem) => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const req = requests[0];
  const item = items.find((i) => i.id === req?.itemId);
  if (!req || !item) return null;

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    try {
      if (approve) {
        await approveEditRequest(gid, req);
        notifyPerson(gid, req.requesterId, `✏️ ${boardName}`, `${myName} 同意你修改「${itemTitle(item)}」了`);
      } else {
        await removeEditRequest(gid, req.id);
      }
    } catch (e) {
      showError(approve ? '同意失敗' : '操作失敗', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={s.card}>
      <Pressable
        onPress={() => onLocate(item)}
        style={s.text}
        accessibilityLabel={`${req.requesterName} 想修改「${itemTitle(item)}」，點一下在白板上找到它`}>
        <Text style={s.title} numberOfLines={1}>
          ✏️ {req.requesterName} 想修改「{itemTitle(item)}」
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {requests.length > 1 ? `還有 ${requests.length - 1} 個修改申請` : `同意後 ${req.requesterName} 就能改這一張`}
        </Text>
      </Pressable>
      <Button kind="ghost" color={C.sub} label="不要" busy={busy === 'reject'} disabled={busy !== null} onPress={() => decide(false)} style={s.btn} />
      <Button color={C.ok} label="同意" busy={busy === 'approve'} disabled={busy !== null} onPress={() => decide(true)} style={s.btn} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: '#EEF6FF',
    borderWidth: 2,
    borderColor: '#CFE4FF',
  },
  text: { flex: 1 },
  title: { fontSize: 16, fontFamily: F.display, color: C.ink },
  sub: { fontSize: 12, color: C.sub, marginTop: 1 },
  btn: { paddingHorizontal: 12 },
});
