import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { countdownLabel, whenLabel } from '@/lib/dates';
import { PRIORITY_META, STATUS_META, isAnnouncement, tagColor, type BoardItem } from '@/lib/types';

import { C, F } from '../ui';

const TAPES = ['#FF9BB8', '#8FD9C4', '#FFD66B', '#A9C8FF', '#C9B4FF'];

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

  // 狀態和標籤：一排小膠囊，放不下的就藏在右邊
  const tags =
    item.status !== 'none' || item.tags.length ? (
      <View style={[s.tags, item.type === 'image' && s.tagsPhoto]}>
        {item.status !== 'none' ? (
          <Pill solid color={STATUS_META[item.status].color} label={`${STATUS_META[item.status].icon} ${STATUS_META[item.status].label}`} />
        ) : null}
        {item.tags.map((tag) => (
          <Pill key={tag} color={tagColor(tag)} label={`#${tag}`} />
        ))}
      </View>
    ) : null;
  const done = item.status === 'done';
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
          <Image source={{ uri: item.imageData }} style={[s.fill, s.photo]} contentFit="cover" />
          {item.text ? (
            <Text style={s.caption} numberOfLines={2}>
              {item.text}
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
        <Text style={[s.noteText, { fontSize: item.fontSize, lineHeight: item.fontSize * 1.35 }, done && s.doneText]}>
          {item.text}
        </Text>
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
  noteText: { flex: 1, padding: 12, color: C.ink, fontFamily: F.display },
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
