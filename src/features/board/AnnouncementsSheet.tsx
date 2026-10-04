import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MemberAvatar } from '@/components/MemberAvatar';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Ionicons, Label } from '@/components/ui';
import { FileRow } from '@/features/files/FileRow';
import { countdownLabel, timeAgo, whenLabel } from '@/lib/dates';
import { PRIORITY_META, isAckedBy, isAnnouncement, itemTitle, type BoardItem, type Member } from '@/lib/types';
import { useNow } from '@/lib/use-now';

/** 所有「要注意的事」：等我確認的公告、接下來的行程、我發的公告誰還沒看 */
export function AnnouncementsSheet({
  gid,
  items,
  members,
  uid,
  onAck,
  onLocate,
  onClose,
}: {
  gid: string;
  items: BoardItem[];
  members: Member[];
  uid: string;
  onAck: (item: BoardItem) => void;
  onLocate: (item: BoardItem) => void;
  onClose: () => void;
}) {
  const now = useNow();
  const pending = items.filter((i) => isAnnouncement(i) && !isAckedBy(i, uid));
  const upcoming = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt + 3_600_000 > now)
    .sort((a, b) => a.dueAt - b.dueAt);
  const mine = items.filter((i) => isAnnouncement(i) && i.authorId === uid);

  return (
    <Sheet visible title="公告與行程" onClose={onClose}>
      <Label>等你確認（{pending.length}）</Label>
      {pending.length === 0 ? (
        <View style={s.allDone}>
          <Ionicons name="checkmark-circle" size={40} color={C.ok} />
          <Text style={s.allDoneText}>全部都看過了，好棒！</Text>
        </View>
      ) : null}
      {pending.map((i) => {
        const color = PRIORITY_META[i.priority].color;
        return (
          <View key={i.id} style={[s.card, { borderColor: color + '55' }]}>
            <View style={[s.chip, { backgroundColor: color }]}>
              <Text style={s.chipText}>
                {i.priority === 'urgent' ? '⚠️' : '📢'} {PRIORITY_META[i.priority].label}・{i.authorName}・{timeAgo(i.createdAt, now)}
              </Text>
            </View>
            <Text style={s.title}>{i.text || itemTitle(i)}</Text>
            {i.dueAt ? (
              <Text style={s.when}>
                📅 {whenLabel(i.dueAt, now)}（{countdownLabel(i.dueAt, now)}）
              </Text>
            ) : null}
            {/* 公告附的檔案（例如學校通知單），看完再按我知道了 */}
            {i.files.length ? (
              <View style={s.files}>
                {i.files.map((f) => (
                  <FileRow key={f.id} gid={gid} file={f} />
                ))}
              </View>
            ) : null}
            <View style={s.actions}>
              <Button kind="ghost" color={C.sub} icon="locate" label="在白板上看" onPress={() => onLocate(i)} />
              <Button style={{ flex: 1 }} icon="checkmark" label="我知道了" color={color} onPress={() => onAck(i)} />
            </View>
          </View>
        );
      })}

      <Label>接下來的行程（{upcoming.length}）</Label>
      {upcoming.length === 0 ? <Text style={s.empty}>還沒有排定日期的事</Text> : null}
      {upcoming.map((i) => (
        <Pressable key={i.id} onPress={() => onLocate(i)} style={s.row}>
          <View style={s.dateBox}>
            <Text style={s.dateText}>{whenLabel(i.dueAt, now)}</Text>
            <Text style={s.countText}>{countdownLabel(i.dueAt, now)}</Text>
          </View>
          <Text style={s.rowTitle} numberOfLines={2}>
            {i.priority === 'urgent' ? '⚠️ ' : ''}
            {itemTitle(i)}
          </Text>
        </Pressable>
      ))}

      {mine.length > 0 ? (
        <>
          <Label>我發的公告・誰還沒看</Label>
          {mine.map((i) => {
            const unread = members.filter((m) => !isAckedBy(i, m.uid));
            return (
              <Pressable key={i.id} onPress={() => onLocate(i)} style={s.row}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {itemTitle(i)}
                </Text>
                {unread.length === 0 ? (
                  <Text style={[s.unreadText, { color: C.ok }]}>全部已讀 ✓</Text>
                ) : (
                  <View style={s.unreadList}>
                    {unread.slice(0, 4).map((m) => (
                      <View key={m.uid} style={s.unreadMember}>
                        <MemberAvatar member={m} size={28} />
                        <Text style={s.unreadName} numberOfLines={1}>
                          {m.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            );
          })}
        </>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  empty: { color: C.sub, fontSize: 15, paddingVertical: 4 },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFFAF5',
    borderRadius: 20,
    padding: 10,
  },
  allDoneText: { fontFamily: F.display, fontSize: 17, color: C.ok },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  chip: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontFamily: F.display, fontSize: 13, color: '#FFF' },
  title: { fontSize: 21, lineHeight: 29, fontFamily: F.display, color: C.ink },
  when: { fontSize: 15, color: C.ink, fontFamily: F.display },
  files: { gap: 6, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#F4EEFF',
  },
  dateBox: { width: 124 },
  dateText: { fontSize: 15, fontFamily: F.display, color: C.ink },
  countText: { fontSize: 12, color: C.sub },
  rowTitle: { flex: 1, fontSize: 16, color: C.ink, fontFamily: F.display },
  unreadText: { fontSize: 13, fontFamily: F.display },
  unreadList: { flexDirection: 'row', gap: 4 },
  unreadMember: { alignItems: 'center', width: 40 },
  unreadName: { fontSize: 10, color: C.urgent },
});
