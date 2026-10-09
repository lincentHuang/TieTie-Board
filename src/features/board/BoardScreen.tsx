import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askConfirm, showError, showNotice } from '@/components/dialogs';
import { MemberAvatar } from '@/components/MemberAvatar';
import { C, F, Ionicons, Squishy, type IconName } from '@/components/ui';
import { AlertOverlay } from '@/features/alerts/AlertOverlay';
import { notifyBoardChange, notifyPerson } from '@/features/alerts/notify';
import { QuickAlertSheet } from '@/features/alerts/QuickAlertSheet';
import { usePushRegistration } from '@/features/alerts/usePushRegistration';
import { FilesSheet } from '@/features/files/FilesSheet';
import { discardFiles, uploadFiles } from '@/features/files/transfer';
import { InstallBanner } from '@/features/settings/InstallBanner';
import { SettingsSheet } from '@/features/settings/SettingsSheet';
import { AccountCard } from '@/features/setup/AccountCard';
import { BoardSwitcherSheet } from '@/features/setup/BoardSwitcherSheet';
import { useWidgetSync } from '@/features/widgets/useWidgetSync';
import { countdownLabel, whenLabel } from '@/lib/dates';
import { pickImage } from '@/lib/images';
import {
  acknowledge,
  acknowledgeAll,
  addItem,
  checkTask,
  deleteItem,
  deleteItems,
  editItem,
  leaveGroup,
  moveItem,
  moveItems,
  organizeItem,
  organizeItems,
  removeEditRequest,
  requestEdit,
} from '@/lib/repo';
import { useSession } from '@/lib/session';
import { useBoardDigests } from '@/lib/use-board-digests';
import {
  byUrgency,
  canDeleteItem,
  canEditItem,
  isAckedBy,
  isAlertActive,
  isAnnouncement,
  itemTitle,
  NOTE_COLORS,
  sameFileSet,
  samePhotoSet,
  tagsInUse,
  viewablePhotos,
  type BoardItem,
  type Geometry,
  type Member,
  type Task,
} from '@/lib/types';
import { useNow } from '@/lib/use-now';

import { AnnouncementsSheet } from './AnnouncementsSheet';
import { CalendarSheet } from './CalendarSheet';
import { Canvas, type CanvasHandle } from './Canvas';
import { EditRequestBanner } from './EditRequestBanner';
import { InviteSheet } from './InviteSheet';
import { defaultDue, ItemEditor, type Draft } from './ItemEditor';
import { ItemViewer } from './ItemViewer';
import { OrganizeManySheet, OrganizeSheet } from './Organize';
import { PhotoViewer } from './PhotoViewer';
import { StickerPicker } from './StickerPicker';
import { SwipeBoard } from './SwipeBoard';
import { TodoPill } from './TodoPill';
import { TodoSheet } from './TodoSheet';
import { newTask, openTodos, sameTasks, type TodoEntry } from './todos';
import { useBoard } from './useBoard';
import { useEditRequests } from './useEditRequests';
import { useJoinRequests } from './useJoinRequests';
import { useSelection } from './useSelection';
import { useViewPrefs } from './useViewPrefs';

type Editing = { draft: Draft; id: string | null; size?: { w: number; h: number } };
type Panel = 'none' | 'stickers' | 'announcements' | 'calendar' | 'todos' | 'invite' | 'boards' | 'alert' | 'settings';
type ToolDef = { icon: IconName; label: string; color: string; onPress: () => void };

const TOOLBAR_HEIGHT = 76;
/** 便利貼有照片時多長高一點，文字才不會被照片擠扁 */
const PHOTO_ROOM = 130;
/** 有附件時多留一排放檔名 */
const FILE_ROOM = 40;
/** 待辦清單每一項多長高一點 */
const TASK_ROOM = 30;
const extraRoom = (d: Pick<Draft, 'photos' | 'files' | 'tasks'>) =>
  (d.photos.length ? PHOTO_ROOM : 0) + (d.files.length ? FILE_ROOM : 0) + d.tasks.length * TASK_ROOM;

export function BoardScreen({
  quickAlert = false,
  onCloseQuickAlert,
}: {
  /** 從小工具的「通報」點進來（網址上的 alert=1）：直接顯示快速通報面板 */
  quickAlert?: boolean;
  onCloseQuickAlert?: () => void;
}) {
  const session = useSession();
  const gid = session.groupId!;
  const uid = session.uid;
  const insets = useSafeAreaInsets();
  // 手機直放時頂部比較擠：家人頭像少放幾個，留位置給公布欄名稱
  const compact = useWindowDimensions().width < 440;
  const { items, members, groupName, ownerId } = useBoard(gid);
  const isOwner = ownerId === uid;
  // 房主才有：等我同意的加入申請
  const requests = useJoinRequests(gid, isOwner);
  // 別人想改我貼的、我想改別人的
  const editRequests = useEditRequests(gid, uid, items);
  // 所有加入的公布欄（不只目前這個）：給桌面小工具與快速通報用
  const digests = useBoardDigests(session.groupIds);
  useWidgetSync(digests, uid, gid);
  usePushRegistration(uid, session.groupIds);
  const canvas = useRef<CanvasHandle>(null);
  const now = useNow();

  const sel = useSelection();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [organizingIds, setOrganizingIds] = useState<string[] | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  /** 點兩下打開的檢視模式 */
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [filesId, setFilesId] = useState<string | null>(null);
  const { prefs, setMode, setGroup } = useViewPrefs();

  if (!items || !prefs) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loading}>正在把公告搬過來…</Text>
      </View>
    );
  }

  const { mode } = prefs;
  const queued = mode === 'queue';
  const free = mode === 'free';
  // 被別人刪掉的項目自動不算在選取裡
  const selection = items.filter((i) => sel.ids.includes(i.id));
  const multi = sel.multi && selection.length > 0;
  const selected = multi ? null : (selection[0] ?? null);
  const organizing = organizingIds ? items.filter((i) => organizingIds.includes(i.id)) : [];
  const editingItem = editing?.id ? items.find((i) => i.id === editing.id) : undefined;
  const canEdit = (item: BoardItem) => canEditItem(item, uid, ownerId);
  const canDelete = (item: BoardItem) => canDeleteItem(item, uid, ownerId);
  const askedFor = (item: BoardItem) => editRequests.outgoing.find((r) => r.itemId === item.id);
  const unacked = (list: BoardItem[]) => list.filter((i) => isAnnouncement(i) && !isAckedBy(i, uid));
  const viewing = items.find((i) => i.id === viewingId);
  const inspecting = items.find((i) => i.id === inspectId);
  const viewingPhotos = viewing ? viewablePhotos(viewing) : [];
  const filesOf = items.find((i) => i.id === filesId);
  const allTags = tagsInUse(items).map((t) => t.tag);
  const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0);
  const pending = unacked(items).sort(byUrgency(uid));
  const nextEvent = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  const readCount = (item: BoardItem) => members.filter((m) => isAckedBy(item, m.uid)).length;
  // 我在這個公布欄發的、還在時效內的快速通報（快速通報面板上再點一下可以收回）
  const mySentAlerts =
    digests?.find((d) => d.gid === gid)?.alerts.filter((a) => a.authorId === uid && isAlertActive(a, now)) ?? [];
  const unreadOf = (memberUid: string) => items.filter((i) => isAnnouncement(i) && !isAckedBy(i, memberUid)).length;
  const todos = openTodos(items, now);
  // 手機上公告、待辦、行程三個膠囊都有：行程縮成只放倒數，前兩個才看得到字
  const crowded = compact && pending.length > 0 && todos.length > 0 && nextEvent !== undefined;

  const ack = (item: BoardItem) => acknowledge(gid, item.id, uid).catch((e) => showError('確認失敗', e));
  const ackMany = (list: BoardItem[]) =>
    acknowledgeAll(gid, list.map((i) => i.id), uid).catch((e) => showError('確認失敗', e));

  /** 待辦打勾 / 取消：清單裡的一項記是誰勾的；狀態是待辦的便利貼就把狀態改成完成（取消的話改回待辦） */
  const toggleTask = (item: BoardItem, task: Task, done: boolean) =>
    checkTask(gid, item.id, task.id, done ? uid : null).catch((e) => showError('打勾失敗', e));
  const tick = (entry: TodoEntry, done: boolean) => {
    if (entry.task) return toggleTask(entry.item, entry.task, done);
    organizeItem(gid, entry.item.id, { status: done ? 'done' : 'todo' }).catch((e) => showError('打勾失敗', e));
  };

  /** 公告 / 活動有變化時，讓其他人的桌面小工具跟著更新（新公告會跳通知） */
  const pushCtx = { gid, uid, boardName: groupName, authorName: session.nickname ?? '' };

  /** 新項目放在目前畫面正中間，疊在最上層；滑動模式看不到白板，就放在所有東西的右邊 */
  const placeNew = (w: number, h: number) => {
    const c = canvas.current?.viewCenter();
    if (c && Number.isFinite(c.x)) return { x: c.x - w / 2, y: c.y - h / 2, w, h, z: maxZ + 1 };
    const right = items.length ? Math.max(...items.map((i) => i.x + i.w)) + 40 : -w / 2;
    const top = items.length ? Math.min(...items.map((i) => i.y)) : -h / 2;
    return { x: right, y: top, w, h, z: maxZ + 1 };
  };

  /** 排隊、滑動時新項目會直接排進去，鏡頭跟過去看它在哪 */
  const showNew = (id: string) => {
    if (!free) canvas.current?.focus(id);
  };

  const create = async (draft: Draft, size: { w: number; h: number }) => {
    const ref = await addItem(gid, {
      ...draft,
      ...placeNew(size.w, size.h),
      authorId: uid,
      authorName: session.nickname ?? '',
    });
    showNew(ref.id);
    notifyBoardChange(pushCtx, null, draft);
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
        dueAt: announcement ? defaultDue(now) : null,
        endAt: null,
        photos: [],
        carousel: false,
        files: [],
        tasks: [],
        status: 'none',
        tags: [],
      },
    });

  /** 待辦清單：一張薄荷色便利貼，一打開就從第一項開始寫 */
  const startList = () =>
    setEditing({
      id: null,
      size: { w: 240, h: 110 },
      draft: {
        type: 'note',
        text: '',
        color: NOTE_COLORS[3],
        fontSize: 20,
        priority: 'none',
        dueAt: null,
        endAt: null,
        photos: [],
        carousel: false,
        files: [],
        tasks: [newTask()],
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
          endAt: null,
          imageData: img.dataUrl,
          photos: [],
          carousel: false,
          files: [],
          tasks: [],
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
        endAt: null,
        photos: [],
        carousel: false,
        files: [],
        tasks: [],
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

  /** 想改別人貼的東西：請作者同意（已經送出的話，問要不要收回） */
  const askEdit = async (item: BoardItem) => {
    const author = item.authorName || '作者';
    const title = itemTitle(item);
    const mine = askedFor(item);
    if (mine) {
      if (!(await askConfirm('收回修改申請？', `還在等 ${author} 同意你修改「${title}」。`))) return;
      removeEditRequest(gid, mine.id).catch((e) => showError('收回失敗', e));
      return;
    }
    if (!(await askConfirm(`請 ${author} 同意你修改？`, `「${title}」是 ${author} 貼的，${author} 同意之後你就能修改。`))) return;
    try {
      const me = session.nickname || '有人';
      await requestEdit(gid, item, uid, me);
      notifyPerson(gid, item.authorId, `✏️ ${groupName}`, `${me} 想修改你貼的「${title}」`);
      showNotice('已經送出', `${author} 同意之後，你就能修改了。`);
    } catch (e) {
      showError('送出失敗', e);
    }
  };

  /** 點兩下卡片：打開檢視模式（只是看，作者本人要改也是再按「編輯」） */
  const inspect = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item && item.type !== 'sticker') setInspectId(id);
  };

  /** 編輯：可以改的話打開編輯視窗，不行就問要不要請作者同意 */
  const open = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type === 'sticker') return;
    if (!canEdit(item)) {
      askEdit(item);
      return;
    }
    const { type, text, color, fontSize, priority, dueAt, endAt, imageData, photos, carousel, files, tasks, status, tags } = item;
    setEditing({
      id,
      draft: { type, text, color, fontSize, priority, dueAt, endAt, imageData, photos, carousel, files, tasks, status, tags },
    });
  };

  /** 編輯視窗按下儲存（檔案已經傳好了） */
  const saveDraft = async (target: Editing, draft: Draft) => {
    if (target.id) {
      // 公告的內容、待辦、照片、檔案、時間或重要程度改了 → 大家要重新確認（只換封面、開關輪播不算）
      const old = target.draft;
      const changed =
        draft.text !== old.text ||
        !sameTasks(draft.tasks, old.tasks) ||
        !samePhotoSet(draft.photos, old.photos) ||
        !sameFileSet(draft.files, old.files) ||
        draft.dueAt !== old.dueAt ||
        draft.endAt !== old.endAt ||
        draft.priority !== old.priority;
      // 第一次加照片 / 檔案、多寫幾項待辦就把卡片拉長；拿掉就縮回來
      const current = items.find((i) => i.id === target.id);
      const h = current?.h;
      const grow = extraRoom(draft) - extraRoom(old);
      const resize = h !== undefined && grow ? { h: Math.max(120, h + grow) } : null;
      // 刪掉的待辦：打勾紀錄也一起清掉
      const dropChecks = Object.keys(current?.checked ?? {}).filter((id) => !draft.tasks.some((t) => t.id === id));
      await editItem(gid, target.id, { ...draft, ...resize }, changed && draft.priority !== 'none', dropChecks);
      discardFiles(gid, old.files.filter((f) => !draft.files.some((g) => g.id === f.id)));
      notifyBoardChange(pushCtx, old, draft);
    } else {
      const size = target.size ?? { w: 220, h: 200 };
      await create(draft, { w: size.w, h: size.h + extraRoom(draft) });
    }
  };

  const commit = (id: string, geo: Geometry) => {
    moveItem(gid, id, geo).catch((e) => showError('移動失敗', e));
  };

  /** 多選時整批一起拖完：每一個都移動一樣多（位置由白板算好） */
  const commitGroup = (moves: { id: string; x: number; y: number }[]) => {
    moveItems(gid, moves.map((m) => ({ id: m.id, geo: { x: m.x, y: m.y } }))).catch((e) => showError('移動失敗', e));
  };

  /** 移到最上層；好幾個的話保持原本彼此的上下順序 */
  const bringToFront = (list: BoardItem[]) =>
    moveItems(
      gid,
      [...list].sort((a, b) => a.z - b.z).map((i, k) => ({ id: i.id, geo: { z: maxZ + 1 + k } })),
    ).catch((e) => showError('調整圖層失敗', e));

  /** 刪掉之後，別人對這些項目的修改申請也沒用了（我是作者的才讀得到、刪得掉） */
  const dropEditRequests = (ids: string[]) => {
    for (const r of editRequests.incoming.filter((r) => ids.includes(r.itemId))) {
      removeEditRequest(gid, r.id).catch((e) => console.warn('清除修改申請失敗', e));
    }
  };

  const remove = async (item: BoardItem) => {
    if (!(await askConfirm('刪除這個項目？', itemTitle(item)))) return;
    try {
      await deleteItem(gid, item.id);
      discardFiles(gid, item.files);
      dropEditRequests([item.id]);
      notifyBoardChange(pushCtx, item, null);
      sel.clear();
      setEditing(null);
    } catch (e) {
      showError('刪除失敗', e);
    }
  };

  /** 多選刪除：只刪自己貼的（房主可以刪全部），別人的留著 */
  const removeMany = async (list: BoardItem[]) => {
    const ok = list.filter(canDelete);
    const skipped = list.length - ok.length;
    const titles = ok.slice(0, 3).map(itemTitle).join('、') + (ok.length > 3 ? ` 等 ${ok.length} 個` : '');
    const note = skipped ? `\n另外 ${skipped} 個是別人貼的，不會刪掉。` : '';
    if (!(await askConfirm(`刪除 ${ok.length} 個項目？`, titles + note))) return;
    try {
      await deleteItems(gid, ok.map((i) => i.id));
      for (const i of ok) discardFiles(gid, i.files);
      dropEditRequests(ok.map((i) => i.id));
      // 小工具上的東西不見了：通知一次讓大家的小工具更新就好
      const onWidget = ok.find((i) => isAnnouncement(i) || i.dueAt !== null);
      if (onWidget) notifyBoardChange(pushCtx, onWidget, null);
      sel.clear();
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
    sel.only(item.id);
    canvas.current?.focus(item.id);
  };

  const toolbarBottom = Math.max(insets.bottom, 12);

  // 底部工具列：沒選取時是新增工具，選一個時是項目操作，多選時是批次操作
  const pick = (list: (ToolDef | false)[]) => list.filter((t): t is ToolDef => t !== false);
  const done: ToolDef = { icon: 'close', label: '完成', color: C.sub, onPress: sel.clear };
  const tools = multi
    ? pick([
        unacked(selection).length > 0 && {
          icon: 'checkmark',
          label: '我知道了',
          color: C.ok,
          onPress: () => ackMany(unacked(selection)),
        },
        { icon: 'pricetags', label: '整理', color: C.mint, onPress: () => setOrganizingIds(selection.map((i) => i.id)) },
        free && { icon: 'layers', label: '最上層', color: C.lavender, onPress: () => bringToFront(selection) },
        selection.some(canDelete) && { icon: 'trash', label: '刪除', color: C.urgent, onPress: () => removeMany(selection) },
        done,
      ])
    : selected
      ? pick([
          unacked([selected]).length > 0 && { icon: 'checkmark', label: '我知道了', color: C.ok, onPress: () => ack(selected) },
          selected.type !== 'sticker' &&
            (canEdit(selected)
              ? { icon: 'create', label: '編輯', color: C.sky, onPress: () => open(selected.id) }
              : askedFor(selected)
                ? { icon: 'hourglass', label: '等待同意', color: C.sub, onPress: () => askEdit(selected) }
                : { icon: 'hand-right', label: '請求編輯', color: C.sky, onPress: () => askEdit(selected) }),
          !canEdit(selected) &&
            selected.files.length > 0 && { icon: 'attach', label: '檔案', color: C.lavender, onPress: () => setFilesId(selected.id) },
          { icon: 'pricetags', label: '整理', color: C.mint, onPress: () => setOrganizingIds([selected.id]) },
          free && { icon: 'layers', label: '最上層', color: C.lavender, onPress: () => bringToFront([selected]) },
          canDelete(selected) && { icon: 'trash', label: '刪除', color: C.urgent, onPress: () => remove(selected) },
          done,
        ])
      : pick([
          { icon: 'document-text', label: '便利貼', color: '#F5B800', onPress: () => startNote(false) },
          { icon: 'checkbox', label: '待辦', color: C.mint, onPress: startList },
          { icon: 'megaphone', label: '公告', color: C.primary, onPress: () => startNote(true) },
          { icon: 'image', label: '照片', color: C.sky, onPress: startImage },
          { icon: 'happy', label: '貼圖', color: C.mint, onPress: () => setPanel('stickers') },
        ]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* 頂部：群組名稱（點了切換公布欄）、家人、通報、公告、設定 */}
      <View style={[s.header, compact && s.headerCompact]}>
        <Pressable onPress={() => setPanel('boards')} style={s.titleBtn} accessibilityLabel={`${groupName}，切換或新增公布欄`}>
          <Text style={[s.groupName, compact && s.groupNameCompact]} numberOfLines={1}>
            {groupName}
          </Text>
          <Ionicons name="chevron-down" size={20} color={C.sub} />
        </Pressable>
        <MemberRow
          members={members}
          uid={uid}
          max={compact ? 2 : 4}
          unreadOf={unreadOf}
          requestCount={requests.length}
          onPress={() => setPanel('invite')}
        />
        <Squishy onPress={() => setPanel('alert')} style={[s.headerBtn, s.alertBtn]} accessibilityLabel="快速通報">
          <Ionicons name="megaphone" size={21} color="#FFF" />
        </Squishy>
        <Squishy onPress={() => setPanel('calendar')} style={s.headerBtn} accessibilityLabel="行事曆">
          <Ionicons name="calendar" size={22} color={C.primary} />
          {pending.length > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{pending.length}</Text>
            </View>
          ) : null}
        </Squishy>
        <Squishy onPress={() => setPanel('settings')} style={[s.headerBtn, s.settingsBtn]} accessibilityLabel="設定">
          <Ionicons name="settings-sharp" size={20} color={C.sub} />
        </Squishy>
      </View>

      {/* 快速通報：別人剛發的（要按收到）、或我發的有幾個人收到 */}
      <AlertOverlay
        digests={digests}
        uid={uid}
        gid={gid}
        memberCount={members.length}
        onOpenBoard={(target) => session.switchGroup(target).catch((e) => showError('切換失敗', e))}
      />

      {/* 有人想改我貼的東西：等我同意 */}
      <EditRequestBanner
        gid={gid}
        boardName={groupName}
        myName={session.nickname ?? ''}
        requests={editRequests.incoming}
        items={items}
        onLocate={locate}
      />

      {/* header 第二行（通知列）：等我確認的公告、還沒做完的待辦（圈圈直接打勾）、下一個行程，壓成一行小膠囊 */}
      <View style={[s.subHeader, compact && s.subHeaderCompact]}>
        {pending.length > 0 ? (
          <Squishy
            style={[s.pill, { backgroundColor: pending[0].priority === 'urgent' ? C.urgent : C.important }]}
            onPress={() => setPanel('announcements')}
            accessibilityLabel={`${pending.length} 則公告等你確認`}>
            <Text style={s.pillText} numberOfLines={1}>
              {pending[0].priority === 'urgent' ? '⚠️' : '📢'} {pending.length > 1 ? `${pending.length} 則待確認・` : ''}
              {itemTitle(pending[0])}
            </Text>
          </Squishy>
        ) : null}
        <TodoPill todos={todos} style={s.pillGrow} onTick={(entry) => tick(entry, true)} onOpen={() => setPanel('todos')} />
        {nextEvent ? (
          <Squishy
            style={[crowded ? s.pillShape : s.pill, { backgroundColor: C.lavender }]}
            onPress={() => locate(nextEvent)}
            accessibilityLabel={`下一個行程：${whenLabel(nextEvent.dueAt, now)} ${itemTitle(nextEvent)}`}>
            <Text style={s.pillText} numberOfLines={1}>
              {/* 三個膠囊擠在手機上時，行程只放倒數 */}
              📅{' '}
              {crowded
                ? countdownLabel(nextEvent.dueAt, now)
                : `${whenLabel(nextEvent.dueAt, now)} ${itemTitle(nextEvent)}・${countdownLabel(nextEvent.dueAt, now)}`}
            </Text>
          </Squishy>
        ) : null}
        {pending.length === 0 && !nextEvent && todos.length === 0 ? (
          <Squishy style={[s.pill, s.pillQuiet]} onPress={() => setPanel('announcements')}>
            <Text style={[s.pillText, { color: C.sub }]} numberOfLines={1}>
              ✓ 公告都看過了・沒有待辦和行程
            </Text>
          </Squishy>
        ) : null}
      </View>

      {mode === 'swipe' ? (
        <SwipeBoard
          ref={canvas}
          items={items}
          now={now}
          onChangeMode={setMode}
          selectedIds={selection.map((i) => i.id)}
          isPending={(i) => isAnnouncement(i) && !isAckedBy(i, uid)}
          readCount={readCount}
          memberCount={members.length}
          onTap={sel.tap}
          onLongPress={sel.longPress}
          onOpen={inspect}
          onAdd={() => startNote(true)}
        />
      ) : (
        <Canvas
          ref={canvas}
          items={items}
          now={now}
          queued={queued}
          onChangeMode={setMode}
          group={prefs.group}
          onChangeGroup={setGroup}
          selectedIds={selection.map((i) => i.id)}
          multi={multi}
          isPending={(i) => isAnnouncement(i) && !isAckedBy(i, uid)}
          readCount={readCount}
          memberCount={members.length}
          onTap={sel.tap}
          onLongPress={sel.longPress}
          onClear={sel.clear}
          onHide={sel.drop}
          onOpen={inspect}
          onCommit={commit}
          onCommitGroup={commitGroup}
        />
      )}

      {items.length === 0 && mode !== 'swipe' ? (
        <View pointerEvents="none" style={s.emptyHint}>
          <Text style={s.emptyTitle}>白板空空的～</Text>
          <Text style={s.emptySub}>
            用下面的工具貼上便利貼、公告或照片{'\n'}點一下選起來再拖曳・長按可以多選・點兩下打開來看
          </Text>
        </View>
      ) : null}

      {/* 手機網頁版：提醒把公布欄裝到手機（按掉一週內不再出現，設定裡一直找得到）；多選時讓位給選取列 */}
      {multi ? null : <InstallBanner bottom={toolbarBottom + TOOLBAR_HEIGHT + 12} onOpen={() => setPanel('settings')} />}

      <View style={[s.toolbarWrap, { paddingBottom: toolbarBottom }]} pointerEvents="box-none">
        {multi ? (
          <View style={s.multiBar}>
            <Text style={s.multiText}>
              已選 {selection.length} 個{free ? '・拖曳任一個一起移動' : ''}
            </Text>
            {selection.length < items.length ? (
              <Pressable
                onPress={() => sel.selectAll(canvas.current?.visibleIds() ?? [])}
                hitSlop={8}
                accessibilityLabel="全選"
                style={({ pressed }) => [s.multiAll, pressed && { opacity: 0.6 }]}>
                <Text style={s.multiAllText}>全選</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={s.toolbar}>
          {tools.map((t) => (
            <Tool key={t.label} {...t} compact={tools.length > 5} />
          ))}
        </View>
      </View>

      {editing ? (
        <ItemEditor
          gid={gid}
          draft={editing.draft}
          isNew={editing.id === null}
          tagSuggestions={allTags}
          onClose={() => setEditing(null)}
          onDelete={editingItem && canDelete(editingItem) ? () => remove(editingItem) : undefined}
          onSave={async (draft, uploads, onProgress) => {
            // 新檔案先傳上去，項目上才記檔名；傳到一半失敗就整個不存，編輯畫面留著可以再按一次
            await uploadFiles(gid, uid, uploads, onProgress);
            try {
              await saveDraft(editing, draft);
            } catch (e) {
              // 項目沒存成功：剛傳的檔案沒人用得到，先清掉（再按一次儲存會重傳）
              discardFiles(gid, uploads.map((u) => u.file));
              throw e;
            }
          }}
        />
      ) : null}
      {organizing.length === 1 ? (
        <OrganizeSheet
          item={organizing[0]}
          suggestions={allTags}
          onChange={(patch) => organizeItem(gid, organizing[0].id, patch).catch((e) => showError('整理失敗', e))}
          onClose={() => setOrganizingIds(null)}
        />
      ) : organizing.length > 1 ? (
        <OrganizeManySheet
          items={organizing}
          suggestions={allTags}
          onChange={(patches) => organizeItems(gid, patches).catch((e) => showError('整理失敗', e))}
          onClose={() => setOrganizingIds(null)}
        />
      ) : null}
      {inspecting ? (
        <ItemViewer
          gid={gid}
          item={inspecting}
          members={members}
          uid={uid}
          now={now}
          access={canEdit(inspecting) ? 'edit' : askedFor(inspecting) ? 'waiting' : 'ask'}
          onAck={() => ack(inspecting)}
          onToggleTask={(task, done) => toggleTask(inspecting, task, done)}
          onEdit={() => {
            setInspectId(null);
            open(inspecting.id);
          }}
          onClose={() => setInspectId(null)}
        />
      ) : null}
      {viewing && viewingPhotos.length ? (
        <PhotoViewer photos={viewingPhotos} onClose={() => setViewingId(null)} />
      ) : null}
      {filesOf ? (
        <FilesSheet
          gid={gid}
          item={filesOf}
          onViewPhotos={() => {
            setFilesId(null);
            setViewingId(filesOf.id);
          }}
          onClose={() => setFilesId(null)}
        />
      ) : null}
      {panel === 'stickers' ? <StickerPicker onPick={addSticker} onClose={() => setPanel('none')} /> : null}
      {panel === 'announcements' ? (
        <AnnouncementsSheet
          gid={gid}
          items={items}
          members={members}
          uid={uid}
          onAck={ack}
          onLocate={locate}
          onClose={() => setPanel('none')}
        />
      ) : null}
      {panel === 'todos' ? (
        <TodoSheet
          items={items}
          members={members}
          uid={uid}
          onTick={tick}
          onLocate={locate}
          onClose={() => setPanel('none')}
        />
      ) : null}
      {panel === 'calendar' ? (
        <CalendarSheet items={items} uid={uid} onAck={ack} onLocate={locate} onClose={() => setPanel('none')} />
      ) : null}
      {panel === 'invite' ? (
        <InviteSheet
          code={gid}
          groupName={groupName}
          members={members}
          uid={uid}
          ownerId={ownerId}
          requests={requests}
          unreadOf={unreadOf}
          onLeave={leave}
          onClose={() => setPanel('none')}
        />
      ) : null}
      {panel === 'boards' ? <BoardSwitcherSheet onClose={() => setPanel('none')} /> : null}
      {panel === 'settings' ? (
        <SettingsSheet
          account={
            <AccountCard
              style={{ marginTop: 0 }}
              hint="登入 LINE 或 Google，換手機、換電腦都還是同一個人"
              anonymousNote="名字只存在這台裝置上"
            />
          }
          onClose={() => setPanel('none')}
        />
      ) : null}
      {panel === 'alert' || quickAlert ? (
        <QuickAlertSheet
          gid={gid}
          boardName={groupName}
          uid={uid}
          nickname={session.nickname ?? ''}
          sent={mySentAlerts}
          memberCount={members.length}
          onClose={() => {
            setPanel('none');
            onCloseQuickAlert?.();
          }}
        />
      ) : null}
    </View>
  );
}

/** 頂部的家人頭像：還有公告沒看的人，頭像右上角有小圓點；有人申請加入時（只有房主看得到）右上角顯示人數 */
function MemberRow({
  members,
  uid,
  max,
  unreadOf,
  requestCount,
  onPress,
}: {
  members: Member[];
  uid: string;
  /** 最多顯示幾個頭像，其他的變成 +N */
  max: number;
  unreadOf: (uid: string) => number;
  requestCount: number;
  onPress: () => void;
}) {
  const sorted = [...members].sort((a, b) => Number(b.uid === uid) - Number(a.uid === uid));
  const shown = sorted.slice(0, max);
  return (
    <Pressable
      onPress={onPress}
      style={s.memberRow}
      accessibilityLabel={requestCount > 0 ? `家人與邀請碼，有 ${requestCount} 個人想加入` : '家人與邀請碼'}>
      {shown.map((m, i) => (
        <View key={m.uid} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}>
          <MemberAvatar member={m} size={34} dot={unreadOf(m.uid) > 0} />
        </View>
      ))}
      {members.length > shown.length ? (
        <Text style={[s.more, max < 4 && s.moreCompact]}>+{members.length - shown.length}</Text>
      ) : null}
      {/* 擠的時候有 +N 就不放「+」，點整排一樣打開家人與邀請 */}
      {max < 4 && members.length > shown.length ? null : (
        <View style={s.addBubble}>
          <Ionicons name="add" size={16} color={C.sub} />
        </View>
      )}
      {requestCount > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{requestCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** compact：工具比較多（六個）時縮窄一點，手機直放才排得下 */
function Tool({ icon, label, color, onPress, compact }: ToolDef & { compact: boolean }) {
  return (
    <Squishy onPress={onPress} style={[s.tool, compact && s.toolCompact]} accessibilityLabel={label}>
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
  headerCompact: { paddingHorizontal: 12, gap: 6 },
  titleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  groupName: { flexShrink: 1, fontSize: 26, fontFamily: F.display, color: C.ink },
  groupNameCompact: { fontSize: 22 },
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
  moreCompact: { marginRight: 6 },
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
  alertBtn: { backgroundColor: C.primary, borderColor: '#FFC2D6' },
  settingsBtn: { backgroundColor: '#F4EEFF', borderColor: '#F4EEFF' },
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
  subHeader: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 6 },
  subHeaderCompact: { paddingHorizontal: 12 },
  pill: { flex: 1, height: 32, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center' },
  // 不設 flex：照字的寬度（網頁版的 flex: 0 會變成寬度 0）
  pillShape: { height: 32, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center' },
  pillQuiet: { backgroundColor: '#FFF', borderWidth: 2, borderColor: C.line },
  pillGrow: { flex: 1 },
  pillText: { color: '#FFF', fontSize: 14, fontFamily: F.display },
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
  toolCompact: { minWidth: 54, paddingHorizontal: 1 },
  multiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 6,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.ink,
  },
  multiText: { fontSize: 14, fontFamily: F.display, color: '#FFF' },
  multiAll: { backgroundColor: '#FFFFFF26', borderRadius: 14, paddingHorizontal: 12, height: 28, justifyContent: 'center' },
  multiAllText: { fontSize: 14, fontFamily: F.display, color: '#FFF' },
  toolIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontSize: 12, fontFamily: F.display, color: C.ink, marginTop: 3 },
});
