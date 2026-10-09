import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { C, F, themed } from '@/components/ui';
import { whenLabel } from '@/lib/dates';
import { byUrgency, isAckedBy, isAnnouncement, itemTitle, type BoardItem } from '@/lib/types';

import { PetAvatar } from './PetAvatar';
import { levelOf, SPECIES, type Mood, type PetConfig } from './pet-types';

export interface PetHelperHandle {
  /** 慶祝一下：跳起來、冒愛心、說一句話 */
  celebrate: (text: string) => void;
}

const BUBBLE_MS = 9000;

/** 依照白板狀態決定小幫手的心情和要說的話 */
function speak(pet: PetConfig, items: BoardItem[], uid: string, now: number): { mood: Mood; text: string; actionable: boolean } {
  const sp = SPECIES[pet.species];
  const pending = items.filter((i) => isAnnouncement(i) && !isAckedBy(i, uid)).sort(byUrgency(uid));
  if (pending.length > 0) {
    const top = pending[0];
    const when = top.dueAt ? `，${whenLabel(top.dueAt, now)}喔` : '';
    const more = pending.length > 1 ? `（還有 ${pending.length - 1} 則）` : '';
    return {
      mood: top.priority === 'urgent' ? 'excited' : 'worried',
      text: `${sp.sound}！${top.authorName}說：「${itemTitle(top)}」${when}${more}\n點我看公告，看完記得按「我知道了」～`,
      actionable: true,
    };
  }
  const next = items
    .filter((i): i is BoardItem & { dueAt: number } => i.dueAt !== null && i.dueAt > now && i.dueAt - now < 48 * 3_600_000)
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  if (next) {
    return { mood: 'happy', text: `${whenLabel(next.dueAt, now)}要「${itemTitle(next)}」，別忘了${sp.sound}！`, actionable: false };
  }
  const hour = new Date(now).getHours();
  if (hour >= 23 || hour < 6) {
    return { mood: 'sleepy', text: `呼嚕…公告都看完了，晚安${sp.sound}～`, actionable: false };
  }
  const idle = [
    `公告都看完了，你好棒${sp.sound}！`,
    `有事就貼在白板上，我幫你提醒大家${sp.sound}～`,
    `摸摸我，我會很開心喔！`,
    `今天也要喝水${sp.sound}～`,
  ];
  return { mood: 'happy', text: idle[Math.floor(now / 120_000) % idle.length], actionable: false };
}

export function PetHelper({
  ref,
  pet,
  xp,
  items,
  uid,
  now,
  bottom,
  onOpenAnnouncements,
}: {
  ref?: Ref<PetHelperHandle>;
  pet: PetConfig;
  xp: number;
  items: BoardItem[];
  uid: string;
  now: number;
  bottom: number;
  onOpenAnnouncements: () => void;
}) {
  const said = speak(pet, items, uid, now);
  const [override, setOverride] = useState<{ text: string; until: number } | null>(null);
  const [bubbleKey, setBubbleKey] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const [jumpKey, setJumpKey] = useState(0);
  const [hearts, setHearts] = useState<number[]>([]);

  const celebrating = override && override.until > now;
  const text = celebrating ? override.text : said.text;
  const mood: Mood = celebrating ? 'excited' : said.mood;
  const { level } = levelOf(xp);

  // 要說的話變了 → 重新冒出對話框
  const [lastText, setLastText] = useState(text);
  if (text !== lastText) {
    setLastText(text);
    setBubbleOpen(true);
    setBubbleKey((k) => k + 1);
  }

  useEffect(() => {
    if (!bubbleOpen) return;
    const t = setTimeout(() => setBubbleOpen(false), BUBBLE_MS);
    return () => clearTimeout(t);
  }, [bubbleOpen, bubbleKey]);

  const burst = (count: number) => {
    const base = Date.now();
    setHearts((h) => [...h, ...Array.from({ length: count }, (_, i) => base + i)]);
    setTimeout(() => setHearts((h) => h.filter((id) => id < base)), 1400);
  };

  useImperativeHandle(ref, () => ({
    celebrate: (message) => {
      setOverride({ text: message, until: Date.now() + 3500 });
      setJumpKey((k) => k + 1);
      burst(6);
      // 慶祝結束後讓畫面重新計算
      setTimeout(() => setOverride(null), 3600);
    },
  }));

  const pat = () => {
    setJumpKey((k) => k + 1);
    burst(2);
    setBubbleOpen(true);
    setBubbleKey((k) => k + 1);
  };

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom }]}>
      <Pressable onPress={pat} accessibilityLabel={`公告小幫手 ${pet.name}`} style={s.petBox}>
        <PetAvatar pet={pet} mood={mood} size={76} jumpKey={jumpKey} />
        <View style={s.level}>
          <Text style={s.levelText}>Lv.{level}</Text>
        </View>
        {hearts.map((id, i) => (
          <FloatingHeart key={id} index={i} />
        ))}
      </Pressable>

      {bubbleOpen ? (
        <Animated.View key={bubbleKey} entering={ZoomIn.springify().damping(14)} exiting={FadeOut} style={s.bubbleWrap}>
          <Pressable
            onPress={() => (said.actionable && !celebrating ? onOpenAnnouncements() : setBubbleOpen(false))}
            style={[s.bubble, said.actionable && !celebrating && s.bubbleAlert]}>
            <View style={[s.tail, said.actionable && !celebrating && s.tailAlert]} />
            <Text style={s.who}>{pet.name || SPECIES[pet.species].defaultName}</Text>
            <Text style={s.say}>{text}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const HEART_CHARS = ['❤️', '💕', '💖', '✨', '🩷'];

function FloatingHeart({ index }: { index: number }) {
  const t = useSharedValue(0);
  const dx = (index % 2 ? 1 : -1) * (8 + ((index * 13) % 26));
  useEffect(() => {
    t.set(withDelay(index * 70, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
  }, [t, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.get(),
    transform: [{ translateY: -80 * t.get() }, { translateX: dx * t.get() }, { scale: 0.6 + t.get() * 0.6 }],
  }));
  return (
    <Animated.Text entering={FadeIn} pointerEvents="none" style={[s.heart, style]}>
      {HEART_CHARS[index % HEART_CHARS.length]}
    </Animated.Text>
  );
}

const s = themed(() => ({
  wrap: { position: 'absolute', left: 8, flexDirection: 'row', alignItems: 'flex-end', maxWidth: '100%' },
  petBox: { alignItems: 'center' },
  level: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: C.lavender,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  levelText: { fontFamily: F.display, color: '#FFF', fontSize: 11 },
  heart: { position: 'absolute', top: 10, left: 28, fontSize: 20 },
  bubbleWrap: { marginLeft: 6, marginBottom: 40, flexShrink: 1, maxWidth: 250 },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: C.line,
    shadowColor: '#6B4FA8',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bubbleAlert: { borderColor: C.primary + '66', backgroundColor: C.primary + '0D' },
  tail: {
    position: 'absolute',
    left: -8,
    bottom: 14,
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: C.line,
    transform: [{ rotate: '45deg' }],
  },
  tailAlert: { borderColor: C.primary + '66', backgroundColor: C.primary + '0D' },
  who: { fontFamily: F.display, fontSize: 12, color: C.primary, marginBottom: 2 },
  say: { fontFamily: F.display, fontSize: 15, lineHeight: 21, color: C.ink },
}));
