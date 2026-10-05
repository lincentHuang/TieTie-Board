import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { showError } from '@/components/dialogs';
import { C, F, Ionicons, Squishy } from '@/components/ui';
import { timeAgo } from '@/lib/dates';
import { ackAlert } from '@/lib/repo';
import { isAlertActive, isAlertForMe, type BoardDigest, type QuickAlert } from '@/lib/types';
import { useNow } from '@/lib/use-now';

import { recallQuickAlert } from './notify';

type Incoming = QuickAlert & { gid: string; boardName: string };

/**
 * 白板上方的快速通報：
 * - 別人發的、我還沒按收到的（所有公布欄都算）：醒目的卡片＋「收到」
 * - 我自己在目前公布欄發的：小膠囊顯示幾個人收到了
 */
export function AlertOverlay({
  digests,
  uid,
  gid,
  memberCount,
  onOpenBoard,
}: {
  digests: BoardDigest[] | null;
  uid: string;
  gid: string;
  memberCount: number;
  onOpenBoard: (gid: string) => void;
}) {
  const now = useNow(15_000);
  /** 自己的通報膠囊按掉之後就不再顯示 */
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [recalling, setRecalling] = useState<string | null>(null);
  if (!digests) return null;

  const recall = async (alert: QuickAlert) => {
    setRecalling(alert.id);
    try {
      await recallQuickAlert(gid, alert.id, uid);
    } catch (e) {
      showError('收回失敗', e);
    } finally {
      setRecalling(null);
    }
  };

  const incoming: Incoming[] = digests
    .flatMap((d) => d.alerts.filter((a) => isAlertForMe(a, uid, now)).map((a) => ({ ...a, gid: d.gid, boardName: d.name })))
    .sort((a, b) => b.createdAt - a.createdAt);
  const mine = digests
    .find((d) => d.gid === gid)
    ?.alerts.find((a) => a.authorId === uid && isAlertActive(a, now) && !dismissed.includes(a.id));

  const top = incoming[0];
  if (top) {
    return (
      <IncomingCard
        key={top.id}
        alert={top}
        more={incoming.length - 1}
        now={now}
        otherBoard={top.gid !== gid}
        onAck={() => ackAlert(top.gid, top.id, uid).catch((e) => showError('回覆失敗', e))}
        onOpenBoard={() => onOpenBoard(top.gid)}
      />
    );
  }
  if (mine) {
    // 自己不算；成員只有自己時就不顯示人數
    const others = Math.max(memberCount - 1, 0);
    const acked = Object.keys(mine.ackBy).filter((id) => id !== uid).length;
    return (
      <Animated.View entering={ZoomIn.duration(220)} style={s.mine}>
        <Text style={s.mineText} numberOfLines={1}>
          📣 已通報「{mine.text}」{others > 0 ? `・${acked}/${others} 人收到` : ''}
        </Text>
        {/* 送錯了：再點一下收回，大家的通報卡片和小工具都會恢復 */}
        <Squishy
          onPress={() => recall(mine)}
          disabled={recalling !== null}
          style={s.recall}
          accessibilityLabel={`收回通報：${mine.text}`}>
          {recalling === mine.id ? (
            <ActivityIndicator size="small" color={C.urgent} />
          ) : (
            <Text style={s.recallText}>收回</Text>
          )}
        </Squishy>
        <Squishy onPress={() => setDismissed((d) => [...d, mine.id])} accessibilityLabel="收起通報狀態">
          <Ionicons name="close" size={18} color={C.sub} />
        </Squishy>
      </Animated.View>
    );
  }
  return null;
}

function IncomingCard({
  alert,
  more,
  now,
  otherBoard,
  onAck,
  onOpenBoard,
}: {
  alert: Incoming;
  more: number;
  now: number;
  otherBoard: boolean;
  onAck: () => void;
  onOpenBoard: () => void;
}) {
  const urgent = alert.level === 'urgent';
  const reduced = useReducedMotion();
  const wiggle = useSharedValue(0);
  const wiggleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.get()}deg` }] }));

  // 剛出現時搖一搖喇叭，吸引注意（減少動態效果時不搖）
  useEffect(() => {
    if (reduced) return;
    wiggle.set(
      withRepeat(
        withSequence(withTiming(-14, { duration: 90 }), withTiming(14, { duration: 90 }), withTiming(0, { duration: 90 })),
        urgent ? 6 : 3,
      ),
    );
  }, [reduced, urgent, wiggle]);

  return (
    <Animated.View
      entering={ZoomIn.springify().damping(14)}
      style={[s.card, { backgroundColor: urgent ? C.urgent : C.primary }]}
      accessibilityRole="alert">
      <Animated.Text style={[s.emoji, wiggleStyle]}>{alert.emoji}</Animated.Text>
      <View style={{ flex: 1 }}>
        <Text style={s.from} numberOfLines={1}>
          {urgent ? '🚨 ' : '📣 '}
          {alert.authorName}・{alert.boardName}・{timeAgo(alert.createdAt, now)}
        </Text>
        <Text style={s.text} numberOfLines={2}>
          {alert.text}
        </Text>
        {more > 0 || otherBoard ? (
          <View style={s.extraRow}>
            {more > 0 ? <Text style={s.more}>還有 {more} 則通報</Text> : null}
            {otherBoard ? (
              <Squishy onPress={onOpenBoard} accessibilityLabel={`切換到 ${alert.boardName}`}>
                <Text style={s.link}>切過去看看 ›</Text>
              </Squishy>
            ) : null}
          </View>
        ) : null}
      </View>
      <Squishy onPress={onAck} style={s.ack} accessibilityLabel="收到">
        <Text style={[s.ackText, { color: urgent ? C.urgent : C.primary }]}>收到 👍</Text>
      </Squishy>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: 24,
    borderBottomWidth: 4,
    borderBottomColor: '#00000026',
    shadowColor: '#6B4FA8',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  emoji: { fontSize: 34 },
  from: { color: '#FFFFFFE6', fontSize: 13, fontFamily: F.display },
  text: { color: '#FFF', fontSize: 20, fontFamily: F.display, marginTop: 1 },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  more: { color: '#FFFFFFCC', fontSize: 12, fontFamily: F.display },
  link: { color: '#FFF', fontSize: 13, fontFamily: F.display, textDecorationLine: 'underline' },
  ack: { backgroundColor: '#FFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  ackText: { fontFamily: F.display, fontSize: 15 },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    maxWidth: '92%',
    marginBottom: 8,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FFC2D6',
  },
  mineText: { flexShrink: 1, fontFamily: F.display, fontSize: 14, color: C.ink },
  recall: { minWidth: 48, height: 26, borderRadius: 13, paddingHorizontal: 10, backgroundColor: '#FFE8EB', alignItems: 'center', justifyContent: 'center' },
  recallText: { fontFamily: F.display, fontSize: 13, color: C.urgent },
});
