import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';

import { RichText } from '@/components/RichText';
import { C, F, Ionicons } from '@/components/ui';
import { fileKind } from '@/features/files/file-kinds';
import { countdownLabel, whenLabel } from '@/lib/dates';
import { plainText } from '@/lib/rich-text';
import {
  PRIORITY_META,
  STATUS_META,
  isAnnouncement,
  isItemDone,
  tagColor,
  taskProgress,
  type Attachment,
  type BoardItem,
} from '@/lib/types';

import { CardTasks } from './Checklist';

const TAPES = ['#FF9BB8', '#8FD9C4', '#FFD66B', '#A9C8FF', '#C9B4FF'];
/** 輪播時每張照片停留多久 */
const SLIDE_MS = 4000;

/** 從 id 算出固定的小變化：每張紙歪的角度、紙膠帶顏色 */
function quirks(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const r = Math.abs(h);
  return { tilt: ((r % 9) - 4) * 0.5, tape: TAPES[r % TAPES.length], tapeTilt: ((r >> 3) % 7) - 3 };
}

/** 白板上每個項目的外觀（不含拖曳邏輯） */
export function ItemBody({
  item,
  now,
  pending,
  readCount,
  memberCount,
  tidy = false,
  w,
  h,
}: {
  item: BoardItem;
  now: number;
  pending: boolean;
  readCount: number;
  memberCount: number;
  /** 排隊時站得直直的，不要歪一邊 */
  tidy?: boolean;
  w: SharedValue<number>;
  h: SharedValue<number>;
}) {
  const stickerStyle = useAnimatedStyle(() => ({
    fontSize: Math.min(w.get(), h.get()) * 0.78,
    lineHeight: Math.min(w.get(), h.get()) * 0.95,
  }));

  if (item.type === 'sticker') {
    return (
      <View style={s.center}>
        <Animated.Text style={[s.sticker, stickerStyle]}>{item.sticker}</Animated.Text>
      </View>
    );
  }

  const q = quirks(item.id);
  const tilt = tidy ? 0 : q.tilt;
  const announce = isAnnouncement(item);
  const meta = PRIORITY_META[item.priority];

  const header =
    announce || item.dueAt ? (
      <View style={[s.header, { backgroundColor: announce ? meta.color : C.mint }]}>
        <Text style={s.headerText} numberOfLines={1}>
          {announce ? `${item.priority === 'urgent' ? '⚠️' : '📢'} ${meta.label}公告` : '📅 活動'}
          {item.dueAt ? `・${whenLabel(item.dueAt, now)}` : ''}
        </Text>
        {item.dueAt ? (
          <Text style={[s.headerText, s.countdown]} numberOfLines={1}>
            {countdownLabel(item.dueAt, now)}
          </Text>
        ) : null}
      </View>
    ) : null;

  // 待辦進度、狀態和標籤：一排小膠囊，放不下的就藏在右邊
  const progress = taskProgress(item);
  const tags =
    progress.total || item.status !== 'none' || item.tags.length ? (
      <View style={[s.tags, item.type === 'image' && s.tagsPhoto]}>
        {progress.total ? (
          <Pill
            solid={progress.done === progress.total}
            color={C.ok}
            label={`☑ ${progress.done}/${progress.total}`}
          />
        ) : null}
        {item.status !== 'none' ? (
          <Pill solid color={STATUS_META[item.status].color} label={`${STATUS_META[item.status].icon} ${STATUS_META[item.status].label}`} />
        ) : null}
        {item.tags.map((tag) => (
          <Pill key={tag} color={tagColor(tag)} label={`#${tag}`} />
        ))}
      </View>
    ) : null;
  // 狀態標成完成、或待辦全部勾完，都蓋「完成」印章
  const done = isItemDone(item);
  const stamp = done ? (
    <View pointerEvents="none" style={[s.stamp, { bottom: announce ? 40 : 12 }]}>
      <Text style={s.stampText}>完成</Text>
    </View>
  ) : null;

  const footer = announce ? (
    <View style={s.footer}>
      <Text style={s.footerText} numberOfLines={1}>
        {item.authorName}
      </Text>
      {pending ? (
        <View style={s.pendingPill}>
          <Text style={s.pendingText}>等你確認</Text>
        </View>
      ) : (
        <Text style={s.footerText} numberOfLines={1}>
          已讀 {readCount}/{memberCount}
        </Text>
      )}
    </View>
  ) : null;

  if (item.type === 'image') {
    return (
      <View style={[s.fill, { transform: [{ rotate: `${tilt}deg` }] }]}>
        <View style={[s.fill, s.polaroid]}>
          {header}
          {/* 照片不收手指：網頁上按著 <img> 拖會變成瀏覽器的「拖曳圖片」，卡片就拖不動 */}
          <Image pointerEvents="none" source={{ uri: item.imageData }} style={[s.fill, s.photo]} contentFit="cover" />
          {item.text ? (
            <Text style={s.caption} numberOfLines={2}>
              {plainText(item.text)}
            </Text>
          ) : null}
          {tags}
          {footer}
        </View>
        {stamp}
        <View style={[s.cornerTape, { left: -14, backgroundColor: q.tape, transform: [{ rotate: '-40deg' }] }]} />
        <View style={[s.cornerTape, { right: -14, backgroundColor: q.tape, transform: [{ rotate: '40deg' }] }]} />
      </View>
    );
  }

  return (
    <View style={[s.fill, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <View style={[s.fill, s.note, { backgroundColor: item.color }, announce && { borderColor: meta.color }]}>
        {header}
        {/* 文字高度不能被卡片限制：iOS 放不下時會把最後一行從字中間切掉，而不是整個字換到下一行。
            所以文字用絕對定位照自己的高度排版，多出來的由外框裁掉 */}
        {item.tasks.length ? (
          // 有待辦清單：文字（清單名稱）和清單一起照自己的高度往下排，放不下的一樣由外框裁掉
          <View style={s.noteBody}>
            <View style={s.noteFlow}>
              {item.text ? (
                <RichText text={item.text} fontSize={item.fontSize} lineHeight={item.fontSize * 1.35} style={[s.flowText, done && s.doneText]} />
              ) : null}
              <CardTasks item={item} fontSize={item.fontSize} />
            </View>
          </View>
        ) : item.text || (!item.photos.length && !item.files.length) ? (
          <View style={s.noteBody}>
            <RichText text={item.text} fontSize={item.fontSize} lineHeight={item.fontSize * 1.35} style={[s.noteText, done && s.doneText]} />
          </View>
        ) : null}
        {item.photos.length ? <CardPhotos photos={item.photos} carousel={item.carousel} /> : null}
        {item.files.length ? <CardFiles files={item.files} big={!item.text && !item.photos.length} /> : null}
        {tags}
        {footer}
      </View>
      {stamp}
      {announce ? null : (
        <View style={[s.tape, { backgroundColor: q.tape, transform: [{ rotate: `${q.tapeTilt}deg` }] }]}>
          <View style={s.tapeStripe} />
        </View>
      )}
    </View>
  );
}

/** 便利貼上的照片：平常只放封面（第一張）；開了輪播就從封面開始輪流換。
    白板上的卡片要能拖曳，所以不做手指滑動（照片也不收手指，按著照片一樣拖得動），其他照片點兩下卡片再看 */
function CardPhotos({ photos, carousel }: { photos: string[]; carousel: boolean }) {
  const reduced = useReducedMotion();
  const rotating = carousel && photos.length > 1;
  const count = photos.length;
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => setAt((n) => (n + 1) % count), SLIDE_MS);
    return () => clearInterval(timer);
  }, [rotating, count]);

  const shown = rotating ? at % count : 0;
  return (
    <View pointerEvents="none" style={s.photos}>
      <Image
        source={{ uri: photos[shown] }}
        style={s.coverPhoto}
        contentFit="cover"
        transition={reduced ? 0 : { duration: 500, effect: 'cross-dissolve' }}
      />
      {rotating ? (
        <View style={s.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[s.dot, i === shown && s.dotOn]} />
          ))}
        </View>
      ) : count > 1 ? (
        // 只放封面時，角落標出總共幾張，大家才知道點進去還有
        <View style={s.more}>
          <Ionicons name="images" size={11} color="#FFF" />
          <Text style={s.moreText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** 便利貼上的附件：平常是一排小標籤；只放了檔案（沒有文字、照片）時，整張卡片就是那個檔案。
    跟照片一樣不收手指，點兩下卡片才打開 */
function CardFiles({ files, big }: { files: Attachment[]; big: boolean }) {
  if (big) {
    const kind = fileKind(files[0]);
    return (
      <View pointerEvents="none" style={s.fileBig}>
        <View style={[s.fileBigIcon, { backgroundColor: kind.color + '1F' }]}>
          <Ionicons name={kind.icon} size={32} color={kind.color} />
          <Text style={[s.fileBigKind, { color: kind.color }]}>{kind.label}</Text>
        </View>
        <Text style={s.fileBigName} numberOfLines={2}>
          {files[0].name}
        </Text>
        {files.length > 1 ? <Text style={s.fileMore}>還有 {files.length - 1} 個檔案</Text> : null}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={s.fileRow}>
      {files.slice(0, 2).map((f) => {
        const kind = fileKind(f);
        return (
          <View key={f.id} style={[s.fileChip, { borderColor: kind.color + '55' }]}>
            <Ionicons name={kind.icon} size={13} color={kind.color} />
            <Text style={s.fileChipText} numberOfLines={1}>
              {f.name}
            </Text>
          </View>
        );
      })}
      {files.length > 2 ? <Text style={s.fileMore}>+{files.length - 2}</Text> : null}
    </View>
  );
}

function Pill({ label, color, solid = false }: { label: string; color: string; solid?: boolean }) {
  return (
    <View style={[s.pill, { backgroundColor: solid ? color : color + '24' }]}>
      <Text style={[s.pillText, { color: solid ? '#FFF' : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const shadow = {
  shadowColor: '#6B4FA8',
  shadowOpacity: 0.18,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 5,
};

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sticker: { textAlign: 'center', textShadowColor: '#6B4FA833', textShadowRadius: 8, textShadowOffset: { width: 0, height: 4 } },
  // 白邊貼紙
  note: { borderRadius: 18, borderWidth: 5, borderColor: '#FFFFFF', overflow: 'hidden', ...shadow },
  noteBody: { flex: 1, overflow: 'hidden' },
  noteText: { position: 'absolute', top: 0, left: 0, right: 0, padding: 12, color: C.ink, fontFamily: F.display },
  noteFlow: { position: 'absolute', top: 0, left: 0, right: 0, padding: 12, gap: 6 },
  flowText: { color: C.ink, fontFamily: F.display },
  // 有文字時照片佔多一點點，照片才看得清楚
  photos: { flex: 1.3, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 4 },
  coverPhoto: { flex: 1, borderRadius: 10, backgroundColor: '#0000000D' },
  dots: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF8C' },
  dotOn: { backgroundColor: '#FFF', width: 14 },
  more: {
    position: 'absolute',
    top: 10,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: '#00000066',
  },
  moreText: { fontSize: 11, color: '#FFF', fontFamily: F.display },
  tape: {
    position: 'absolute',
    top: -11,
    alignSelf: 'center',
    width: '46%',
    height: 22,
    opacity: 0.75,
    borderRadius: 3,
    justifyContent: 'center',
  },
  tapeStripe: { height: 6, backgroundColor: '#FFFFFF66' },
  cornerTape: { position: 'absolute', top: 4, width: 56, height: 20, opacity: 0.75, borderRadius: 3 },
  polaroid: { backgroundColor: '#FFF', padding: 8, paddingBottom: 10, borderRadius: 8, ...shadow },
  photo: { borderRadius: 4 },
  caption: { paddingTop: 8, paddingHorizontal: 2, fontSize: 16, color: C.ink, fontFamily: F.display },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  headerText: { color: '#FFF', fontFamily: F.display, fontSize: 13, flexShrink: 1 },
  countdown: { marginLeft: 'auto' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footerText: { fontSize: 12, color: C.sub, fontFamily: F.display },
  pendingPill: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pendingText: { fontSize: 12, color: '#FFF', fontFamily: F.display },
  tags: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingBottom: 8, overflow: 'hidden' },
  tagsPhoto: { paddingHorizontal: 2, paddingTop: 6, paddingBottom: 0 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 8, overflow: 'hidden' },
  fileChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFFCC',
  },
  fileChipText: { flexShrink: 1, fontSize: 12, fontFamily: F.display, color: C.ink },
  fileMore: { fontSize: 12, fontFamily: F.display, color: C.sub },
  fileBig: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, overflow: 'hidden' },
  fileBigIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  fileBigKind: { fontSize: 11, fontFamily: F.display, marginTop: -2 },
  fileBigName: { fontSize: 15, fontFamily: F.display, color: C.ink, textAlign: 'center' },
  pill: { flexShrink: 0, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 12, fontFamily: F.display },
  doneText: { opacity: 0.5 },
  // 蓋在右下角的「完成」印章
  stamp: {
    position: 'absolute',
    right: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: C.ok,
    backgroundColor: '#FFFFFFB3',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-14deg' }],
  },
  stampText: { fontSize: 16, fontFamily: F.display, color: C.ok },
});
