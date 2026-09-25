import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, F, Label } from '@/components/ui';

import { PetAvatar } from './PetAvatar';
import { ACCESSORIES, FUR_COLORS, SPECIES, type PetConfig, type Species } from './pet-types';

/** 捏寵物：選物種、毛色、配件、取名字。每改一次寵物會開心跳一下 */
export function PetEditor({ value, onChange }: { value: PetConfig; onChange: (pet: PetConfig) => void }) {
  const [hop, setHop] = useState(0);
  const set = (patch: Partial<PetConfig>) => {
    setHop((n) => n + 1);
    onChange({ ...value, ...patch });
  };

  return (
    <View>
      <View style={s.stage}>
        <PetAvatar pet={value} mood="happy" size={140} jumpKey={hop} />
        <Text style={s.name}>{value.name || SPECIES[value.species].defaultName}</Text>
      </View>

      <Label>選一種動物</Label>
      <View style={s.row}>
        {(Object.keys(SPECIES) as Species[]).map((sp) => {
          const active = value.species === sp;
          return (
            <Pressable
              key={sp}
              accessibilityRole="button"
              accessibilityLabel={SPECIES[sp].label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                // 換物種時，如果名字還是預設的就一起換
                const isDefaultName = !value.name || value.name === SPECIES[value.species].defaultName;
                set({ species: sp, ...(isDefaultName ? { name: SPECIES[sp].defaultName } : null) });
              }}
              style={[s.speciesChip, active && s.chipActive]}>
              <PetAvatar pet={{ ...value, species: sp, accessory: 'none' }} size={40} animated={false} />
              <Text style={[s.chipText, active && { color: C.primary }]}>{SPECIES[sp].label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label>毛色</Label>
      <View style={s.row}>
        {FUR_COLORS.map((c) => (
          <Pressable
            key={c.value}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            accessibilityState={{ selected: value.color === c.value }}
            onPress={() => set({ color: c.value })}
            style={[s.swatch, { backgroundColor: c.value }, value.color === c.value && s.swatchActive]}
          />
        ))}
      </View>

      <Label>配件</Label>
      <View style={s.row}>
        {ACCESSORIES.map((a) => {
          const active = value.accessory === a.value;
          return (
            <Pressable
              key={a.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => set({ accessory: a.value })}
              style={[s.pill, active && s.pillActive]}>
              <Text style={[s.pillText, active && { color: '#FFF' }]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label>幫牠取個名字</Label>
      <TextInput
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        placeholder={SPECIES[value.species].defaultName}
        placeholderTextColor="#B9B2CF"
        maxLength={8}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  stage: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 28,
    backgroundColor: '#FFF0F6',
    borderWidth: 2,
    borderColor: '#FFE0EC',
    borderStyle: 'dashed',
  },
  name: { fontFamily: F.display, fontSize: 22, color: C.ink, marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  speciesChip: {
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: '#FFF',
    minWidth: 56,
  },
  chipActive: { borderColor: C.primary, backgroundColor: '#FFF0F6' },
  chipText: { fontFamily: F.display, fontSize: 13, color: C.ink, marginTop: 2 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: C.line },
  swatchActive: { borderWidth: 4, borderColor: C.primary },
  pill: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: '#F1EBFB', justifyContent: 'center' },
  pillActive: { backgroundColor: C.lavender },
  pillText: { fontFamily: F.display, fontSize: 14, color: C.ink },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 18,
    fontFamily: F.display,
    color: C.ink,
  },
});
