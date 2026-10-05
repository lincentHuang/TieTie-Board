import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemberAvatar } from '@/components/MemberAvatar';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Ionicons, Label } from '@/components/ui';
import { FileRow } from '@/features/files/FileRow';
import { countdownLabel, timeAgo, whenLabel } from '@/lib/dates';
import {
  PRIORITY_META,
  STATUS_META,
  isAckedBy,
  isAnnouncement,
  tagColor,
  viewablePhotos,
  type BoardItem,
  type Member,
} from '@/lib/types';

import { PhotoViewer } from './PhotoViewer';

/** 編輯按鈕要顯示什麼：可以直接改、要請作者同意、已經送出申請在等 */
export type EditAccess = 'edit' | 'ask' | 'waiting';

/**
 * 檢視模式（點兩下卡片）：完整的內容、照片、附件、誰看過了。
 * 只是看，不會不小心改到；要改的話按下面的「編輯」（作者本人也一樣）
 */
export function ItemViewer({
  gid,
  item,
  members,
  uid,
  now,
  access,
  onAck,
  onEdit,
  onClose,
}: {
  gid: string;
  item: BoardItem;
  members: Member[];
  uid: string;
  now: number;
  access: EditAccess;
  onAck: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [photoAt, setPhotoAt] = useState<number | null>(null);
  const announce = isAnnouncement(item);
  const meta = PRIORITY_META[item.priority];
  const pending = !isAckedBy(item, uid);
  const photos = viewablePhotos(item);
  const unread = announce ? members.filter((m) => !isAckedBy(item, m.uid)) : [];
  const title = announce ? `${item.priority === 'urgent' ? '⚠️' : '📢'} ${meta.label}公告` : item.type === 'image' ? '📷 照片' : item.dueAt ? '📅 活動' : '📝 便利貼';

  const edit =
    access === 'edit'
      ? { label: '編輯', icon: 'create' as const, color: C.sky }
      : access === 'waiting'
        ? { label: '等待同意', icon: 'hourglass' as const, color: C.sub }
        : { label: '請求編輯', icon: 'hand-right' as const, color: C.sky };

  return (
    <Sheet
      visible
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button kind={pending ? 'soft' : 'primary'} big color={edit.color} icon={edit.icon} label={edit.label} onPress={onEdit} style={pending ? undefined : { flex: 1 }} />
          {pending ? (
            <Button big style={{ flex: 1 }} icon="checkmark" label="我知道了" color={meta.color} onPress={onAck} />
          ) : null}
        </>
      }>
      <Text style={s.byline}>
        {item.authorName || '有人'} 貼的・{timeAgo(item.createdAt, now)}
      </Text>

      {item.dueAt ? (
        <View style={[s.when, { backgroundColor: (announce ? meta.color : C.mint) + '1F' }]}>
          <Ionicons name="calendar" size={18} color={announce ? meta.color : C.mint} />
          <Text style={s.whenText}>{whenLabel(item.dueAt, now)}</Text>
          <Text style={s.whenSub}>{countdownLabel(item.dueAt, now)}</Text>
        </View>
      ) : null}

      {item.type === 'image' && item.imageData ? (
        <Pressable onPress={() => setPhotoAt(0)} accessibilityLabel="放大看照片">
          <Image source={{ uri: item.imageData }} style={s.bigPhoto} contentFit="contain" />
        </Pressable>
      ) : null}

      {item.text ? (
        <View style={[s.paper, item.type === 'note' && { backgroundColor: item.color === 'transparent' ? '#FFF' : item.color }]}>
          <Text selectable style={[s.text, item.status === 'done' && s.doneText]}>
            {item.text}
          </Text>
        </View>
      ) : null}

      {item.type === 'note' && photos.length ? (
        <>
          <Label>照片（{photos.length}）・點一下放大</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
            {photos.map((uri, i) => (
              <Pressable key={i} onPress={() => setPhotoAt(i)} accessibilityLabel={`看第 ${i + 1} 張照片`}>
                <Image source={{ uri }} style={s.thumb} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {item.files.length ? (
        <>
          <Label>附件（{item.files.length}）</Label>
          <View style={{ gap: 8 }}>
            {item.files.map((f) => (
              <FileRow key={f.id} gid={gid} file={f} />
            ))}
          </View>
        </>
      ) : null}

      {item.status !== 'none' || item.tags.length ? (
        <View style={s.pills}>
          {item.status !== 'none' ? (
            <View style={[s.pill, { backgroundColor: STATUS_META[item.status].color }]}>
              <Text style={[s.pillText, { color: '#FFF' }]}>
                {STATUS_META[item.status].icon} {STATUS_META[item.status].label}
              </Text>
            </View>
          ) : null}
          {item.tags.map((tag) => (
            <View key={tag} style={[s.pill, { backgroundColor: tagColor(tag) + '24' }]}>
              <Text style={[s.pillText, { color: tagColor(tag) }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {announce ? (
        <>
          <Label>
            已讀 {members.length - unread.length}/{members.length}
          </Label>
          {unread.length === 0 ? (
            <Text style={[s.readAll]}>大家都看過了 ✓</Text>
          ) : (
            <View style={s.unread}>
              {unread.map((m) => (
                <View key={m.uid} style={s.unreadMember}>
                  <MemberAvatar member={m} size={32} />
                  <Text style={s.unreadName} numberOfLines={1}>
                    {m.uid === uid ? '我' : m.name}
                  </Text>
                </View>
              ))}
              <Text style={s.unreadHint}>還沒看</Text>
            </View>
          )}
        </>
      ) : null}

      {photoAt !== null ? <PhotoViewer photos={photos} start={photoAt} onClose={() => setPhotoAt(null)} /> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  byline: { fontSize: 13, fontFamily: F.display, color: C.sub, marginBottom: 10 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  whenText: { fontSize: 17, fontFamily: F.display, color: C.ink },
  whenSub: { marginLeft: 'auto', fontSize: 13, fontFamily: F.display, color: C.sub },
  bigPhoto: { width: '100%', height: 280, borderRadius: 18, backgroundColor: '#F4EEFF', marginBottom: 10 },
  paper: { backgroundColor: '#F7F2FF', borderRadius: 18, padding: 14, borderWidth: 2, borderColor: '#0000000A' },
  text: { fontSize: 19, lineHeight: 28, fontFamily: F.display, color: C.ink },
  doneText: { opacity: 0.55, textDecorationLine: 'line-through' },
  thumbs: { gap: 8 },
  thumb: { width: 110, height: 110, borderRadius: 14, backgroundColor: '#F4EEFF' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  pill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 13, fontFamily: F.display },
  readAll: { fontSize: 15, fontFamily: F.display, color: C.ok },
  unread: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  unreadMember: { alignItems: 'center', width: 44 },
  unreadName: { fontSize: 11, color: C.urgent, fontFamily: F.display },
  unreadHint: { fontSize: 12, color: C.sub, fontFamily: F.display },
});
