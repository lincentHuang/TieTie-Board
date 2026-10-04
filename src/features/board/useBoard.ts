import { useEffect, useState } from 'react';

import { syncReminders } from '@/lib/reminders';
import { watchGroup, watchItems, watchMembers } from '@/lib/repo';
import type { BoardItem, GroupInfo, Member } from '@/lib/types';

/** 即時同步白板內容，並順便排好提醒通知（桌面小工具由 useWidgetSync 負責，涵蓋所有公布欄） */
export function useBoard(groupId: string) {
  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [group, setGroup] = useState<GroupInfo>({ name: '公布欄', ownerId: '' });

  useEffect(() => {
    const unsubs = [watchItems(groupId, setItems), watchMembers(groupId, setMembers), watchGroup(groupId, setGroup)];
    return () => unsubs.forEach((u) => u());
  }, [groupId]);

  useEffect(() => {
    if (!items) return;
    syncReminders(items).catch((e) => console.warn('排程提醒失敗', e));
  }, [items]);

  return { items, members, groupName: group.name, ownerId: group.ownerId };
}
