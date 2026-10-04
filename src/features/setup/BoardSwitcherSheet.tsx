import { StyleSheet, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Sheet } from '@/components/Sheet';
import { C, F, Ionicons, Squishy } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colorOf } from '@/lib/types';

import { AccountCard } from './AccountCard';
import { GroupForm } from './GroupForm';
import { PendingJoins } from './PendingJoins';
import { useGroupNames } from './useGroupNames';

/** 我加入的所有公布欄：點一下切換過去，下面可以再加入或建立一個 */
export function BoardSwitcherSheet({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const names = useGroupNames(session.groupIds);

  const pick = async (gid: string) => {
    if (gid === session.groupId) return onClose();
    try {
      await session.switchGroup(gid);
    } catch (e) {
      showError('切換失敗', e);
    }
  };

  return (
    <Sheet visible title="我的公布欄" onClose={onClose}>
      <View style={s.list}>
        {session.groupIds.map((gid) => {
          const current = gid === session.groupId;
          const name = names[gid];
          return (
            <Squishy
              key={gid}
              onPress={() => pick(gid)}
              style={[s.row, current && s.rowCurrent]}
              accessibilityLabel={current ? `${name ?? gid}（目前）` : `切換到 ${name ?? gid}`}>
              <View style={[s.icon, { backgroundColor: colorOf(gid) }]}>
                <Text style={s.iconText}>{(name && Array.from(name.trim())[0]) || '📌'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {name ?? '讀取中…'}
                </Text>
                <Text style={s.code}>邀請碼 {gid}</Text>
              </View>
              {current ? (
                <View style={s.currentChip}>
                  <Text style={s.currentText}>目前</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={C.sub} />
              )}
            </Squishy>
          );
        })}
      </View>
      <PendingJoins />

      <GroupForm title="新增公布欄" onDone={onClose} />

      <AccountCard hint="登入 LINE 或 Google，換手機、換電腦都還是同一個人" />
    </Sheet>
  );
}

const s = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowCurrent: { borderColor: '#FFC2D6', backgroundColor: '#FFF7FA' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontFamily: F.display, fontSize: 20, color: '#FFF' },
  name: { fontFamily: F.display, fontSize: 18, color: C.ink },
  code: { fontSize: 12, color: C.sub, marginTop: 2, letterSpacing: 1 },
  currentChip: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  currentText: { fontFamily: F.display, fontSize: 13, color: '#FFF' },
});
