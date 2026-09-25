import { useEffect, useState } from 'react';

import { syncReminders } from '@/lib/reminders';
import { watchGroupName, watchItems, watchMembers } from '@/lib/repo';
import type { BoardItem, Member } from '@/lib/types';
import { buildWidgetSource } from '@/lib/widget-data';
import { syncWidget } from '@/lib/widget-sync';

/** 即時同步白板內容，並順便更新桌面小工具與提醒通知 */
export function useBoard(groupId: string, uid: string) {
  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupName, setGroupName] = useState('公布欄');

  useEffect(() => {
    const unsubs = [
      watchItems(groupId, setItems),
      watchMembers(groupId, setMembers),
      watchGroupName(groupId, setGroupName),
    ];
    return () => unsubs.forEach((u) => u());
  }, [groupId]);

  useEffect(() => {
    if (!items) return;
    syncWidget(buildWidgetSource(items, uid, groupName)).catch((e) => console.warn('更新小工具失敗', e));
    syncReminders(items).catch((e) => console.warn('排程提醒失敗', e));
  }, [items, uid, groupName]);

  return { items, members, groupName };
}
