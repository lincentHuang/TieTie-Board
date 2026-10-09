import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { C, F, Ionicons, themed } from '@/components/ui';

import type { QueuePage } from './queue-order';

/** 排隊模式右上角的分頁：公告 / 記事（也可以在白板上左右滑切換）；最右邊 📦 切換看已完成（封存）的 */
export function QueueTabs({
  pages,
  page,
  onChange,
  archive,
  archivedCount,
  onToggleArchive,
}: {
  pages: QueuePage[];
  page: number;
  onChange: (page: number) => void;
  archive: boolean;
  archivedCount: number;
  onToggleArchive: () => void;
}) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={s.bar} accessibilityRole="tablist">
      {pages.map((p, i) => {
        const active = i === page;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${p.label}，${p.items.length} 則`}
            style={({ pressed }) => [s.tab, active && s.tabOn, pressed && { opacity: 0.6 }]}>
            <Text style={[s.text, active && s.white]}>
              {p.icon} {p.label}
            </Text>
            <View style={[s.count, active && s.countOn]}>
              <Text style={[s.countText, active && s.white]}>{p.items.length}</Text>
            </View>
          </Pressable>
        );
      })}
      {archivedCount || archive ? (
        <>
          <View style={s.divider} />
          <Pressable
            onPress={onToggleArchive}
            accessibilityRole="switch"
            accessibilityState={{ checked: archive }}
            accessibilityLabel={archive ? '回到隊伍' : `看已完成的（${archivedCount} 則）`}
            style={({ pressed }) => [s.archive, archive && s.archiveOn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="archive" size={16} color={archive ? '#FFF' : C.sub} />
            <Text style={[s.archiveCount, archive && s.white]}>{archivedCount}</Text>
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );
}

const s = themed(() => ({
  bar: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFEE',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.line,
    padding: 3,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingLeft: 10, paddingRight: 5, borderRadius: 14 },
  tabOn: { backgroundColor: C.primary },
  divider: { width: 2, height: 20, borderRadius: 1, backgroundColor: C.line },
  archive: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 34, paddingHorizontal: 8, borderRadius: 14 },
  archiveOn: { backgroundColor: C.ok },
  archiveCount: { fontSize: 12, fontFamily: F.display, color: C.sub },
  text: { fontSize: 14, fontFamily: F.display, color: C.ink },
  white: { color: '#FFF' },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary + '1F',
  },
  countOn: { backgroundColor: '#FFFFFF44' },
  countText: { fontSize: 12, fontFamily: F.display, color: C.primary },
}));
