import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../Sheet';
import { Label } from '../ui';

const GROUPS: { name: string; stickers: string[] }[] = [
  { name: '提醒', stickers: ['📌', '⚠️', '❗', '⏰', '📅', '✅', '❌', '🔔', '💯', '🆗'] },
  { name: '慶祝', stickers: ['🎉', '🎂', '🎈', '🎁', '🥳', '🏆', '🌟', '💐', '🍾', '🎊'] },
  { name: '心情', stickers: ['😀', '😍', '😂', '🥲', '😭', '😴', '😡', '🤔', '👍', '❤️'] },
  { name: '生活', stickers: ['🧹', '🍳', '🛒', '🗑️', '💊', '🐶', '🐱', '🌱', '🚗', '🏠'] },
  { name: '活動', stickers: ['⚽', '🏀', '🏸', '🎵', '📚', '✈️', '🏕️', '🎬', '🍱', '🙏'] },
];

export function StickerPicker({ onPick, onClose }: { onPick: (sticker: string) => void; onClose: () => void }) {
  return (
    <Sheet visible title="選一個貼圖" onClose={onClose}>
      {GROUPS.map((g) => (
        <View key={g.name}>
          <Label>{g.name}</Label>
          <View style={s.grid}>
            {g.stickers.map((st) => (
              <Pressable
                key={st}
                onPress={() => onPick(st)}
                style={({ pressed }) => [s.cell, pressed && { backgroundColor: '#0001' }]}>
                <Text style={s.emoji}>{st}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 34 },
});
