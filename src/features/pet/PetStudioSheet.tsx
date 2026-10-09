import { useState } from 'react';
import { Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, C, F, themed } from '@/components/ui';

import { PetEditor } from './PetEditor';
import { levelOf, titleOf, XP, type PetConfig } from './pet-types';

/** 我的小幫手：看等級、重新捏外觀 */
export function PetStudioSheet({
  pet: initial,
  xp,
  onSave,
  onClose,
}: {
  pet: PetConfig;
  xp: number;
  onSave: (pet: PetConfig) => Promise<void>;
  onClose: () => void;
}) {
  const [pet, setPet] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { level, progress, toNext } = levelOf(xp);

  return (
    <Sheet
      visible
      title="我的公告小幫手"
      onClose={onClose}
      footer={
        <Button
          big
          style={{ flex: 1 }}
          label="就決定是你了！"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            await onSave(pet);
            onClose();
          }}
        />
      }>
      <View style={s.levelCard}>
        <View style={s.levelRow}>
          <Text style={s.levelBig}>Lv.{level}</Text>
          <Text style={s.levelTitle}>{titleOf(level)}</Text>
        </View>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${Math.max(6, progress * 100)}%` }]} />
        </View>
        <Text style={s.levelHint}>
          再 {toNext} 點升級。確認一則公告 +{XP.ack}、發一則公告 +{XP.post}
        </Text>
      </View>
      <PetEditor value={pet} onChange={setPet} />
    </Sheet>
  );
}

const s = themed(() => ({
  levelCard: { backgroundColor: C.canvas, borderRadius: 20, padding: 14, marginBottom: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  levelBig: { fontFamily: F.display, fontSize: 26, color: C.lavender },
  levelTitle: { fontFamily: F.display, fontSize: 16, color: C.ink },
  bar: { height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', marginTop: 8, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6, backgroundColor: C.primary },
  levelHint: { fontSize: 12, color: C.sub, marginTop: 6 },
}));
