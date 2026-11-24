import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, C, F, Ionicons, Label, Segmented, themed } from '@/components/ui';
import { rangeLabel } from '@/lib/dates';
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

import { DateTimeField } from './DateTimeField';

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
type When = Pick<BoardItem, 'dueAt' | 'endAt'>;

/** 下一個整點（跟編輯畫面新增時間的預設一樣） */
const nextHour = () => {
  const d = new Date();
  d.setHours(Math.min(23, d.getHours() + 1), 0, 0, 0);
  return d.getTime();
};

/** 改開始時間時，有結束時間的保留原本的長度 */
const moveStart = (item: BoardItem, dueAt: number | null): When => ({
  dueAt,
  endAt: dueAt === null || item.dueAt === null || item.endAt === null ? null : dueAt + (item.endAt - item.dueAt),
});

/** 一起改時間：選一個時間按「套用」，全部改成同一個開始時間；也可以全部拿掉時間 */
function WhenPicker({ items, onChange }: { items: BoardItem[]; onChange: (changes: { id: string; when: When }[]) => void }) {
  const first = items[0]?.dueAt ?? null;
  const same = items.every((i) => i.dueAt === first);
  const [value, setValue] = useState(() => (same && first !== null ? first : nextHour()));
  const timed = items.filter((i) => i.dueAt !== null);
  const sameAsNow = same && first === value;

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.current}>
        {same ? (first === null ? '現在都沒有設時間' : `現在都是 ${rangeLabel(first, items[0].endAt)}`) : `現在時間不一樣（${timed.length} 個有設時間）`}
      </Text>
      <DateTimeField value={value} onChange={setValue} />
      <View style={s.inputRow}>
        <Button
          style={{ flex: 1 }}
          icon="time"
          label={`全部設成這個時間`}
          disabled={sameAsNow}
          onPress={() => onChange(items.map((i) => ({ id: i.id, when: moveStart(i, value) })))}
        />
        {timed.length ? (
          <Button
            kind="soft"
            color={C.sub}
            label="拿掉時間"
            onPress={() => onChange(timed.map((i) => ({ id: i.id, when: { dueAt: null, endAt: null } })))}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * 多選後一起改：狀態一次改成同一個；時間只改自己能編輯的（別人的要作者同意才能改內容）；
 * 標籤只顯示大家都有的，加上去的會加到每一個（滿 5 個的就不加），拿掉的會從每一個拿掉
 */
export function OrganizeManySheet({
  items,
  suggestions,
  canEdit,
  onChange,
  onReschedule,
  onClose,
}: {
  items: BoardItem[];
  suggestions: string[];
  canEdit: (item: BoardItem) => boolean;
  onChange: (patches: { id: string; patch: OrganizePatch }[]) => void;
  onReschedule: (changes: { id: string; when: When }[]) => void;
  onClose: () => void;
}) {
  const editable = items.filter((i) => i.type !== 'sticker' && canEdit(i));
  const skipped = items.filter((i) => i.type !== 'sticker').length - editable.length;
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
    <Sheet visible title={`一起改 ${items.length} 個`} onClose={onClose} footer={<Button style={{ flex: 1 }} big label="好了" onPress={onClose} />}>
      <Text style={s.itemTitle} numberOfLines={2}>
        {items.map(itemTitle).join('、')}
      </Text>
      <Label>狀態</Label>
      <StatusPicker value={status} onChange={(st) => onChange(items.map((i) => ({ id: i.id, patch: { status: st } })))} />
      <Text style={s.hint}>{status === null ? '現在每個的狀態不一樣，選一個就全部改成一樣。' : '選一個就全部一起改。'}</Text>
      <Label>時間</Label>
      {editable.length ? (
        <WhenPicker items={editable} onChange={onReschedule} />
      ) : (
        <Text style={s.current}>選的都是別人貼的，時間要請作者同意後才能改。</Text>
      )}
      {editable.length && skipped ? <Text style={s.hint}>有 {skipped} 個是別人貼的，時間不會改（要請作者同意）。</Text> : null}
      <Label>大家都有的標籤</Label>
      <TagPicker value={common} suggestions={suggestions} onChange={changeTags} />
      <Text style={s.hint}>加上的標籤會貼到每一個；拿掉的會從每一個拿掉。</Text>
    </Sheet>
  );
}

const s = themed(() => ({
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
  itemTitle: { fontSize: 17, fontFamily: F.display, color: C.ink, backgroundColor: C.bg, borderRadius: 14, padding: 12 },
  current: { fontSize: 14, color: C.ink, backgroundColor: C.bg, borderRadius: 12, padding: 10 },
  hint: { fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 18 },
}));
