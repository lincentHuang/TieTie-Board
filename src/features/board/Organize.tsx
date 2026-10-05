import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, C, F, Ionicons, Label, Segmented } from '@/components/ui';
import {
  MAX_TAGS,
  normalizeTag,
  STARTER_TAGS,
  STATUS_META,
  STATUSES,
  itemTitle,
  tagColor,
  type BoardItem,
  type ItemStatus,
} from '@/lib/types';

export function StatusPicker({ value, onChange }: { value: ItemStatus | null; onChange: (status: ItemStatus) => void }) {
  return (
    <Segmented<ItemStatus>
      value={value}
      onChange={onChange}
      options={STATUSES.map((st) => ({
        value: st,
        label: st === 'none' ? '沒有' : `${STATUS_META[st].icon} ${STATUS_META[st].label}`,
        color: st === 'none' ? C.sub : STATUS_META[st].color,
      }))}
    />
  );
}

/** 選標籤：點已選的可以拿掉，下面是大家用過的（和常用的）標籤，也可以自己打新的 */
export function TagPicker({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState('');
  const full = value.length >= MAX_TAGS;
  const typed = normalizeTag(text);
  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    setText('');
    if (tag && !full && !value.includes(tag)) onChange([...value, tag]);
  };
  const others = [...new Set([...suggestions, ...STARTER_TAGS])].filter((t) => !value.includes(t)).slice(0, 12);

  return (
    <View style={{ gap: 10 }}>
      <View style={s.wrap}>
        {value.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => onChange(value.filter((t) => t !== tag))}
            accessibilityLabel={`拿掉標籤 ${tag}`}
            style={({ pressed }) => [s.tag, { backgroundColor: tagColor(tag) }, pressed && s.pressed]}>
            <Text style={s.tagOnText}>#{tag}</Text>
            <Ionicons name="close" size={14} color="#FFF" />
          </Pressable>
        ))}
        {value.length === 0 ? <Text style={s.empty}>還沒有標籤</Text> : null}
      </View>

      <View style={s.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => add(text)}
          submitBehavior="submit"
          returnKeyType="done"
          editable={!full}
          maxLength={14}
          placeholder={full ? `最多 ${MAX_TAGS} 個標籤` : '打一個新標籤，例如：倒垃圾'}
          placeholderTextColor="#B9B2CF"
          style={s.input}
        />
        <Pressable
          onPress={() => add(text)}
          disabled={!typed || full}
          accessibilityLabel="加上這個標籤"
          style={({ pressed }) => [s.addBtn, (!typed || full) && { opacity: 0.35 }, pressed && s.pressed]}>
          <Ionicons name="add" size={22} color="#FFF" />
        </Pressable>
      </View>

      {others.length && !full ? (
        <View style={s.wrap}>
          {others.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => add(tag)}
              accessibilityLabel={`加上標籤 ${tag}`}
              style={({ pressed }) => [s.tag, s.suggest, { borderColor: tagColor(tag) + '66' }, pressed && s.pressed]}>
              <Text style={[s.suggestText, { color: tagColor(tag) }]}>+ #{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 選取項目後的「整理」：狀態、標籤，大家都可以改，改了馬上同步 */
export function OrganizeSheet({
  item,
  suggestions,
  onChange,
  onClose,
}: {
  item: BoardItem;
  suggestions: string[];
  onChange: (patch: Partial<Pick<BoardItem, 'status' | 'tags'>>) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible title="整理" onClose={onClose} footer={<Button style={{ flex: 1 }} big label="好了" onPress={onClose} />}>
      <Text style={s.itemTitle} numberOfLines={2}>
        {itemTitle(item)}
      </Text>
      <Label>狀態</Label>
      <StatusPicker value={item.status} onChange={(status) => onChange({ status })} />
      <Text style={s.hint}>全家都可以改。排隊「依狀態」分隊時，改了它就會自己走到那一隊。</Text>
      <Label>標籤</Label>
      <TagPicker value={item.tags} suggestions={suggestions} onChange={(tags) => onChange({ tags })} />
    </Sheet>
  );
}

type OrganizePatch = Partial<Pick<BoardItem, 'status' | 'tags'>>;

/**
 * 多選後一起整理：狀態一次改成同一個；標籤只顯示大家都有的，
 * 加上去的會加到每一個（滿 5 個的就不加），拿掉的會從每一個拿掉
 */
export function OrganizeManySheet({
  items,
  suggestions,
  onChange,
  onClose,
}: {
  items: BoardItem[];
  suggestions: string[];
  onChange: (patches: { id: string; patch: OrganizePatch }[]) => void;
  onClose: () => void;
}) {
  const status = items.every((i) => i.status === items[0]?.status) ? (items[0]?.status ?? null) : null;
  const common = (items[0]?.tags ?? []).filter((t) => items.every((i) => i.tags.includes(t)));
  const changeTags = (next: string[]) => {
    const added = next.filter((t) => !common.includes(t));
    const removed = common.filter((t) => !next.includes(t));
    onChange(
      items.map((i) => {
        const kept = i.tags.filter((t) => !removed.includes(t));
        const tags = [...kept, ...added.filter((t) => !kept.includes(t))].slice(0, MAX_TAGS);
        return { id: i.id, patch: { tags } };
      }),
    );
  };

  return (
    <Sheet visible title={`整理 ${items.length} 個`} onClose={onClose} footer={<Button style={{ flex: 1 }} big label="好了" onPress={onClose} />}>
      <Text style={s.itemTitle} numberOfLines={2}>
        {items.map(itemTitle).join('、')}
      </Text>
      <Label>狀態</Label>
      <StatusPicker value={status} onChange={(st) => onChange(items.map((i) => ({ id: i.id, patch: { status: st } })))} />
      <Text style={s.hint}>{status === null ? '現在每個的狀態不一樣，選一個就全部改成一樣。' : '選一個就全部一起改。'}</Text>
      <Label>大家都有的標籤</Label>
      <TagPicker value={common} suggestions={suggestions} onChange={changeTags} />
      <Text style={s.hint}>加上的標籤會貼到每一個；拿掉的會從每一個拿掉。</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 16 },
  tagOnText: { fontSize: 14, fontFamily: F.display, color: '#FFF' },
  suggest: { borderWidth: 2, backgroundColor: '#FFF' },
  suggestText: { fontSize: 14, fontFamily: F.display },
  empty: { fontSize: 14, color: C.sub, lineHeight: 32 },
  pressed: { opacity: 0.6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 2,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: F.display,
    color: C.ink,
  },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 17, fontFamily: F.display, color: C.ink, backgroundColor: '#F7F2FF', borderRadius: 14, padding: 12 },
  hint: { fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 18 },
});
