import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Ionicons, Label, themed } from '@/components/ui';
import { rangeLabel, startOfDay, timeOfDay } from '@/lib/dates';
import { PRIORITY_META, isAckedBy, isAnnouncement, itemTitle, type BoardItem } from '@/lib/types';
import { useNow } from '@/lib/use-now';

import { itemsByDay, monthGrid, type DayKey } from './calendar';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 行事曆：月曆上有事的日子有小圓點，點一天只列出那天的公告與行程，下面可以直接在那天新增公告 */
export function CalendarSheet({
  items,
  uid,
  onAck,
  onLocate,
  onAdd,
  onClose,
}: {
  items: BoardItem[];
  uid: string;
  onAck: (item: BoardItem) => void;
  onLocate: (item: BoardItem) => void;
  /** 在選的那天新增公告（day = 那天 0 點） */
  onAdd: (day: number) => void;
  onClose: () => void;
}) {
  const now = useNow();
  const today = startOfDay(now);
  const [picked, setPicked] = useState<DayKey>(today);
  const [month, setMonth] = useState(() => {
    const d = new Date(now);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const byDay = itemsByDay(items);
  const cells = monthGrid(month.y, month.m);
  const dayItems = byDay.get(picked) ?? [];
  const pickedDate = new Date(picked);

  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const d = new Date(now);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setPicked(today);
  };

  return (
    <Sheet
      visible
      fill
      title="行事曆"
      onClose={onClose}
      footer={
        <View style={{ flex: 1 }}>
          <Button
            icon="add"
            label={`在 ${pickedDate.getMonth() + 1}/${pickedDate.getDate()}（${WEEKDAYS[pickedDate.getDay()]}）新增公告`}
            onPress={() => onAdd(picked)}
          />
        </View>
      }>
      <View style={s.monthBar}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} style={s.arrow} accessibilityLabel="上個月">
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </Pressable>
        <Text style={s.monthText}>
          {month.y} 年 {month.m + 1} 月
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} style={s.arrow} accessibilityLabel="下個月">
          <Ionicons name="chevron-forward" size={22} color={C.ink} />
        </Pressable>
        <Pressable onPress={goToday} style={s.todayBtn} accessibilityLabel="回到今天">
          <Text style={s.todayText}>今天</Text>
        </Pressable>
      </View>

      <View style={s.grid}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} style={[s.weekday, (i === 0 || i === 6) && { color: C.primary }]}>
            {w}
          </Text>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={s.cell} />;
          const list = byDay.get(day) ?? [];
          const isPicked = day === picked;
          const isToday = day === today;
          const waiting = list.some((it) => isAnnouncement(it) && !isAckedBy(it, uid));
          return (
            <Pressable
              key={day}
              onPress={() => setPicked(day)}
              style={s.cell}
              accessibilityLabel={`${new Date(day).getDate()} 日${list.length ? `，${list.length} 件事` : ''}`}>
              <View style={[s.dayCircle, isToday && s.todayCircle, isPicked && s.pickedCircle]}>
                <Text style={[s.dayText, isToday && { color: C.primary }, isPicked && { color: '#FFF' }]}>
                  {new Date(day).getDate()}
                </Text>
              </View>
              <View style={s.dots}>
                {list.length ? <View style={[s.dot, { backgroundColor: waiting ? C.urgent : C.lavender }]} /> : null}
                {list.length > 1 ? <View style={[s.dot, { backgroundColor: C.lavender }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Label>
        {pickedDate.getMonth() + 1}/{pickedDate.getDate()}（{WEEKDAYS[pickedDate.getDay()]}）
        {picked === today ? '今天' : ''}的公告（{dayItems.length}）
      </Label>
      {dayItems.length === 0 ? <Text style={s.empty}>這天沒有公告或行程</Text> : null}
      {dayItems.map((i) => {
        const waiting = isAnnouncement(i) && !isAckedBy(i, uid);
        const color = isAnnouncement(i) ? PRIORITY_META[i.priority].color : C.lavender;
        return (
          <Pressable key={i.id} onPress={() => onLocate(i)} style={[s.card, { borderColor: color + '55' }]}>
            <View style={s.cardHead}>
              <Text style={[s.time, { color }]}>
                {i.dueAt === null
                  ? `📢 ${i.createdAt ? timeOfDay(i.createdAt) : ''} 發布`
                  : i.endAt === null
                    ? `📅 ${timeOfDay(i.dueAt)}`
                    : startOfDay(i.dueAt) === startOfDay(i.endAt)
                      ? `📅 ${timeOfDay(i.dueAt)}–${timeOfDay(i.endAt)}`
                      : `📅 ${rangeLabel(i.dueAt, i.endAt)}`}
              </Text>
              <Text style={s.author} numberOfLines={1}>
                {i.authorName}
              </Text>
            </View>
            {i.text ? (
              <RichText linkable text={i.text} fontSize={17} lineHeight={24} style={s.title} />
            ) : (
              <Text style={s.title}>{itemTitle(i)}</Text>
            )}
            {waiting ? (
              <Button icon="checkmark" label="我知道了" color={color} onPress={() => onAck(i)} />
            ) : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const s = themed(() => ({
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas },
  monthText: { flex: 1, textAlign: 'center', fontFamily: F.display, fontSize: 19, color: C.ink },
  todayBtn: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.primary + '22' },
  todayText: { fontFamily: F.display, fontSize: 14, color: C.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: F.display, fontSize: 13, color: C.sub, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, minHeight: 50 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { borderWidth: 2, borderColor: C.primary },
  pickedCircle: { backgroundColor: C.primary, borderColor: C.primary },
  dayText: { fontFamily: F.display, fontSize: 16, color: C.ink },
  dots: { flexDirection: 'row', gap: 3, height: 7, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  empty: { color: C.sub, fontSize: 15, paddingVertical: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 2, padding: 12, marginBottom: 8, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontFamily: F.display, fontSize: 15 },
  author: { flex: 1, textAlign: 'right', fontSize: 13, color: C.sub },
  title: { fontSize: 17, lineHeight: 24, fontFamily: F.display, color: C.ink },
}));
