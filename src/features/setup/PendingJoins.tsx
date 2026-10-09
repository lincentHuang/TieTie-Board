import { Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Button, C, F, Ionicons, themed } from '@/components/ui';
import { removeJoinRequest } from '@/lib/repo';
import { useSession } from '@/lib/session';

import { useGroupNames } from './useGroupNames';

/** 送出申請、等房主同意的公布欄（同意後會自動加入，見 usePendingJoins），可以收回 */
export function PendingJoins() {
  const session = useSession();
  const names = useGroupNames(session.pendingIds);
  if (!session.pendingIds.length) return null;

  // 先從清單拿掉再刪申請：申請不見時，才不會被當成「房主拒絕了」
  const cancel = (gid: string) => {
    session.settlePending(gid, false);
    removeJoinRequest(gid, session.uid).catch((e) => showError('收回申請失敗', e));
  };

  return (
    <View style={s.list}>
      {session.pendingIds.map((gid) => (
        <View key={gid} style={s.row}>
          <Ionicons name="hourglass-outline" size={24} color={C.important} />
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {names[gid] ?? '讀取中…'}
            </Text>
            <Text style={s.hint}>已送出加入申請，房主同意後就會自動加入</Text>
          </View>
          <Button kind="ghost" color={C.sub} label="收回" onPress={() => cancel(gid)} />
        </View>
      ))}
    </View>
  );
}

const s = themed(() => ({
  list: { gap: 8, marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8EC',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFE2B8',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 6,
  },
  name: { fontFamily: F.display, fontSize: 17, color: C.ink },
  hint: { fontSize: 12, color: C.sub, marginTop: 2 },
}));
