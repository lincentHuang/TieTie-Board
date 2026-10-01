import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askConfirm, showError } from '@/components/dialogs';
import { MemberAvatar } from '@/components/MemberAvatar';
import { C, F, Ionicons, Squishy, type IconName } from '@/components/ui';
import { countdownLabel, whenLabel } from '@/lib/dates';
import { pickImage } from '@/lib/images';
import { acknowledge, addItem, deleteItem, editItem, leaveGroup, moveItem, organizeItem } from '@/lib/repo';
import { useSession } from '@/lib/session';
import {
  byUrgency,
  isAckedBy,
  isAnnouncement,
  itemTitle,
  NOTE_COLORS,
  samePhotoSet,
  tagsInUse,
  viewablePhotos,
  type BoardItem,
  type Geometry,
  type Member,
} from '@/lib/types';
import { useNow } from '@/lib/use-now';

import { AnnouncementsSheet } from './AnnouncementsSheet';
import { Canvas, type CanvasHandle } from './Canvas';
import { InviteSheet } from './InviteSheet';
import { ItemEditor, type Draft } from './ItemEditor';
import { OrganizeSheet } from './Organize';
import { PhotoViewer } from './PhotoViewer';
import { StickerPicker } from './StickerPicker';
import { useBoard } from './useBoard';
import { useViewPrefs } from './useViewPrefs';

type Editing = { draft: Draft; id: string | null; size?: { w: number; h: number } };
type Panel = 'none' | 'stickers' | 'announcements' | 'invite';

const TOOLBAR_HEIGHT = 76;
/** 便利貼有照片時多長高一點，文字才不會被照片擠扁 */
const PHOTO_ROOM = 130;

export function BoardScreen() {
  const session = useSession();
  const gid = session.groupId!;
  const uid = session.uid;
  const insets = useSafeAreaInsets();
  const { items, members, groupName } = useBoard(gid, uid);
  const canvas = useRef<CanvasHandle>(null);
  const now = useNow();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [organizingId, setOrganizingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const { prefs, setQueued, setGroup } = useViewPrefs();

  if (!items || !prefs) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loading}>正在把公告搬過來…</Text>
      </View>
    );
  }

  const { queued } = prefs;
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const organizing = items.find((i) => i.id === organizingId) ?? null;
  const viewing = items.find((i) => i.id === viewingId);
  const viewingPhotos = viewing ? viewablePhotos(viewing) : [];
  const allTags = tagsInUse(items).map((t) => t.tag);
  const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0);
  const pending = items.filter((i) => isAnnouncement(i) && !isAckedBy(i, uid)).sort(byUrgency(uid));
  const nextEvent = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  const readCount = (item: BoardItem) => members.filter((m) => isAckedBy(item, m.uid)).length;
  const unreadOf = (memberUid: string) => items.filter((i) => isAnnouncement(i) && !isAckedBy(i, memberUid)).length;

  const ack = (item: BoardItem) => acknowledge(gid, item.id, uid).catch((e) => showError('確認失敗', e));

  /** 新項目放在目前畫面正中間，疊在最上層 */
  const placeNew = (w: number, h: number) => {
    const c = canvas.current?.viewCenter() ?? { x: 0, y: 0 };
    return { x: c.x - w / 2, y: c.y - h / 2, w, h, z: maxZ + 1 };
  };

  /** 排隊時新項目會直接站進隊伍裡，鏡頭跟過去看它排在哪 */
  const showNew = (id: string) => {
    if (queued) canvas.current?.focus(id);
  };

  const create = async (draft: Draft, size: { w: number; h: number }) => {
    const ref = await addItem(gid, {
      ...draft,
      ...placeNew(size.w, size.h),
      authorId: uid,
      authorName: session.nickname ?? '',
    });
    showNew(ref.id);
  };

  const startNote = (announcement: boolean) =>
    setEditing({
      id: null,
      size: announcement ? { w: 300, h: 220 } : { w: 220, h: 200 },
      draft: {
        type: 'note',
        text: '',
        color: announcement ? '#FFFFFF' : NOTE_COLORS[0],
        fontSize: announcement ? 28 : 20,
        priority: announcement ? 'important' : 'none',
        dueAt: null,
        photos: [],
        carousel: false,
        status: 'none',
        tags: [],
      },
    });

  const startImage = async () => {
    try {
      const img = await pickImage();
      if (!img) return;
      const w = 280;
      const h = Math.round((w * img.height) / img.width) + 18;
      setEditing({
        id: null,
        size: { w, h },
        draft: {
          type: 'image',
          text: '',
          color: '#FFFFFF',
          fontSize: 16,
          priority: 'none',
          dueAt: null,
          imageData: img.dataUrl,
          photos: [],
          carousel: false,
          status: 'none',
          tags: [],
        },
      });
    } catch (e) {
      showError('無法讀取圖片', e);
    }
  };

  const addSticker = async (sticker: string) => {
    setPanel('none');
    try {
      const ref = await addItem(gid, {
        type: 'sticker',
        sticker,
        text: '',
        color: 'transparent',
        fontSize: 20,
        priority: 'none',
        dueAt: null,
        photos: [],
        carousel: false,
        status: 'none',
        tags: [],
        ...placeNew(120, 120),
        authorId: uid,
        authorName: session.nickname ?? '',
      });
      showNew(ref.id);
    } catch (e) {
      showError('貼圖貼不上去', e);
    }
  };

  const open = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type === 'sticker') return;
    if (item.authorId !== uid) {
      // 別人的東西不能改內容：有照片就全螢幕看照片，是公告就打開確認面板
      if (viewablePhotos(item).length) setViewingId(id);
      else if (isAnnouncement(item)) setPanel('announcements');
      return;
    }
    const { type, text, color, fontSize, priority, dueAt, imageData, photos, carousel, status, tags } = item;
    setEditing({
      id,
      draft: { type, text, color, fontSize, priority, dueAt, imageData, photos, carousel, status, tags },
    });
  };

  const commit = (id: string, geo: Geometry) => {
    moveItem(gid, id, geo).catch((e) => showError('移動失敗', e));
  };

  const bringToFront = (item: BoardItem) =>
    moveItem(gid, item.id, { z: maxZ + 1 }).catch((e) => showError('調整圖層失敗', e));

  const remove = async (item: BoardItem) => {
    if (!(await askConfirm('刪除這個項目？', itemTitle(item)))) return;
    try {
      await deleteItem(gid, item.id);
      setSelectedId(null);
      setEditing(null);
    } catch (e) {
      showError('刪除失敗', e);
    }
  };

  const leave = async () => {
    if (!(await askConfirm(`離開「${groupName}」？`, '之後可以用邀請碼再加入。'))) return;
    try {
      await leaveGroup(gid, uid);
      setPanel('none');
      await session.leaveGroup();
    } catch (e) {
      showError('離開群組失敗', e);
    }
  };

  const locate = (item: BoardItem) => {
    setPanel('none');
    setSelectedId(item.id);
    canvas.current?.focus(item.id);
  };

  const toolbarBottom = Math.max(insets.bottom, 12);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* 頂部：群組名稱、家人、公告按鈕 */}
      <View style={s.header}>
        <Text style={s.groupName} numberOfLines={1}>
          {groupName}
        </Text>
        <MemberRow members={members} uid={uid} unreadOf={unreadOf} onPress={() => setPanel('invite')} />
        <Squishy onPress={() => setPanel('announcements')} style={s.headerBtn} accessibilityLabel="公告與行程">
          <Ionicons name="calendar" size={22} color={C.primary} />
          {pending.length > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{pending.length}</Text>
            </View>
          ) : null}
        </Squishy>
      </View>

      {/* 最重要的事：沒確認的公告 > 下一個行程 */}
      {pending.length > 0 ? (
        <Squishy
          style={[s.banner, { backgroundColor: pending[0].priority === 'urgent' ? C.urgent : C.important }]}
          onPress={() => setPanel('announcements')}>
          <Text style={s.bannerIcon}>{pending[0].priority === 'urgent' ? '⚠️' : '📢'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle} numberOfLines={1}>
              {itemTitle(pending[0])}
            </Text>
            <Text style={s.bannerSub} numberOfLines={1}>
              {pending.length > 1 ? `還有 ${pending.length} 則公告等你確認` : '這則公告等你確認'}
              {pending[0].dueAt ? `・${whenLabel(pending[0].dueAt, now)}` : ''}
            </Text>
          </View>
          <View style={s.bannerAction}>
            <Text style={s.bannerActionText}>去看看</Text>
          </View>
        </Squishy>
      ) : nextEvent ? (
        <Squishy style={[s.banner, { backgroundColor: C.lavender }]} onPress={() => locate(nextEvent)}>
          <Text style={s.bannerIcon}>📅</Text>
          <Text style={[s.bannerTitle, { flex: 1 }]} numberOfLines={1}>
            {whenLabel(nextEvent.dueAt, now)}　{itemTitle(nextEvent)}
          </Text>
          <Text style={s.bannerSub}>{countdownLabel(nextEvent.dueAt, now)}</Text>
        </Squishy>
      ) : null}

      <Canvas
        ref={canvas}
        items={items}
        now={now}
        queued={queued}
        onChangeMode={setQueued}
        group={prefs.group}
        onChangeGroup={setGroup}
        selectedId={selectedId}
        isPending={(i) => isAnnouncement(i) && !isAckedBy(i, uid)}
        readCount={readCount}
        memberCount={members.length}
        onSelect={setSelectedId}
        onOpen={open}
        onCommit={commit}
      />

      {items.length === 0 ? (
        <View pointerEvents="none" style={s.emptyHint}>
          <Text style={s.emptyTitle}>白板空空的～</Text>
          <Text style={s.emptySub}>
            用下面的工具貼上便利貼、公告或照片{'\n'}拖曳移動・拖四個角調整大小・點兩下編輯
          </Text>
        </View>
      ) : null}

      {/* 底部工具列：沒選取時是新增工具，選取時變成項目操作 */}
      <View style={[s.toolbarWrap, { paddingBottom: toolbarBottom }]} pointerEvents="box-none">
        <View style={s.toolbar}>
          {selected ? (
            <>
              {isAnnouncement(selected) && !isAckedBy(selected, uid) ? (
                <Tool icon="checkmark" label="我知道了" color={C.ok} onPress={() => ack(selected)} />
              ) : null}
              {selected.authorId === uid && selected.type !== 'sticker' ? (
                <Tool icon="create" label="編輯" color={C.sky} onPress={() => open(selected.id)} />
              ) : null}
              <Tool icon="pricetags" label="整理" color={C.mint} onPress={() => setOrganizingId(selected.id)} />
              {queued ? null : (
                <Tool icon="layers" label="最上層" color={C.lavender} onPress={() => bringToFront(selected)} />
              )}
              {selected.authorId === uid ? (
                <Tool icon="trash" label="刪除" color={C.urgent} onPress={() => remove(selected)} />
              ) : null}
              <Tool icon="close" label="完成" color={C.sub} onPress={() => setSelectedId(null)} />
            </>
          ) : (
            <>
              <Tool icon="document-text" label="便利貼" color="#F5B800" onPress={() => startNote(false)} />
              <Tool icon="megaphone" label="公告" color={C.primary} onPress={() => startNote(true)} />
              <Tool icon="image" label="照片" color={C.sky} onPress={startImage} />
              <Tool icon="happy" label="貼圖" color={C.mint} onPress={() => setPanel('stickers')} />
            </>
          )}
        </View>
      </View>

      {editing ? (
        <ItemEditor
          draft={editing.draft}
          isNew={editing.id === null}
          tagSuggestions={allTags}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? () => remove(items.find((i) => i.id === editing.id)!) : undefined}
          onSave={async (draft) => {
            const hasPhotos = draft.photos.length > 0;
            if (editing.id) {
              // 公告的內容、照片、時間或重要程度改了 → 大家要重新確認（只換封面、開關輪播不算）
              const old = editing.draft;
              const changed =
                draft.text !== old.text ||
                !samePhotoSet(draft.photos, old.photos) ||
                draft.dueAt !== old.dueAt ||
                draft.priority !== old.priority;
              // 第一次加照片就把卡片拉長；照片全部拿掉就縮回來
              const h = items.find((i) => i.id === editing.id)?.h;
              const hadPhotos = old.photos.length > 0;
              const resize =
                h !== undefined && hasPhotos !== hadPhotos
                  ? { h: hasPhotos ? h + PHOTO_ROOM : Math.max(120, h - PHOTO_ROOM) }
                  : null;
              await editItem(gid, editing.id, { ...draft, ...resize }, changed && draft.priority !== 'none');
            } else {
              const size = editing.size ?? { w: 220, h: 200 };
              await create(draft, hasPhotos ? { w: size.w, h: size.h + PHOTO_ROOM } : size);
            }
          }}
        />
      ) : null}
      {organizing ? (
        <OrganizeSheet
          item={organizing}
          suggestions={allTags}
          onChange={(patch) => organizeItem(gid, organizing.id, patch).catch((e) => showError('整理失敗', e))}
          onClose={() => setOrganizingId(null)}
        />
      ) : null}
      {viewing && viewingPhotos.length ? (
        <PhotoViewer photos={viewingPhotos} onClose={() => setViewingId(null)} />
      ) : null}
      {panel === 'stickers' ? <StickerPicker onPick={addSticker} onClose={() => setPanel('none')} /> : null}
      {panel === 'announcements' ? (
        <AnnouncementsSheet
          items={items}
          members={members}
          uid={uid}
          onAck={ack}
          onLocate={locate}
          onClose={() => setPanel('none')}
        />
      ) : null}
      {panel === 'invite' ? (
        <InviteSheet
          code={gid}
          groupName={groupName}
          members={members}
          uid={uid}
          unreadOf={unreadOf}
          onLeave={leave}
          onClose={() => setPanel('none')}
        />
      ) : null}
    </View>
  );
}

/** 頂部的家人頭像：還有公告沒看的人，頭像右上角有小圓點 */
function MemberRow({
  members,
  uid,
  unreadOf,
  onPress,
}: {
  members: Member[];
  uid: string;
  unreadOf: (uid: string) => number;
  onPress: () => void;
}) {
  const sorted = [...members].sort((a, b) => Number(b.uid === uid) - Number(a.uid === uid));
  const shown = sorted.slice(0, 4);
  return (
    <Pressable onPress={onPress} style={s.memberRow} accessibilityLabel="家人與邀請碼">
      {shown.map((m, i) => (
        <View key={m.uid} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}>
          <MemberAvatar member={m} size={34} dot={unreadOf(m.uid) > 0} />
        </View>
      ))}
      {members.length > shown.length ? <Text style={s.more}>+{members.length - shown.length}</Text> : null}
      <View style={s.addBubble}>
        <Ionicons name="add" size={16} color={C.sub} />
      </View>
    </Pressable>
  );
}

function Tool({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Squishy onPress={onPress} style={s.tool} accessibilityLabel={label}>
      <View style={[s.toolIcon, { backgroundColor: color + '26' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={s.toolText}>{label}</Text>
    </Squishy>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loading: { fontFamily: F.display, fontSize: 16, color: C.sub, marginTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  groupName: { flex: 1, fontSize: 26, fontFamily: F.display, color: C.ink },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 22,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 4,
    borderWidth: 2,
    borderColor: C.line,
  },
  more: { fontFamily: F.display, fontSize: 12, color: C.sub, marginLeft: 4 },
  addBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F4EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: { color: '#FFF', fontSize: 11, fontFamily: F.display },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 22,
    borderBottomWidth: 4,
    borderBottomColor: '#00000022',
  },
  bannerIcon: { fontSize: 22 },
  bannerTitle: { color: '#FFF', fontSize: 18, fontFamily: F.display },
  bannerSub: { color: '#FFFFFFE6', fontSize: 13, fontFamily: F.display, marginTop: 1 },
  bannerAction: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  bannerActionText: { fontFamily: F.display, fontSize: 14, color: C.ink },
  emptyHint: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 24, fontFamily: F.display, color: C.sub },
  emptySub: { fontSize: 15, color: C.sub, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  toolbarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    height: TOOLBAR_HEIGHT,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 8,
    gap: 2,
    borderWidth: 2,
    borderColor: C.line,
    shadowColor: '#6B4FA8',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tool: { alignItems: 'center', justifyContent: 'center', minWidth: 64, paddingHorizontal: 4 },
  toolIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontSize: 12, fontFamily: F.display, color: C.ink, marginTop: 3 },
});
