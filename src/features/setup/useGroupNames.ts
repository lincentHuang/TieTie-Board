import { useEffect, useState } from 'react';

import { watchGroupName } from '@/lib/repo';

/** 即時讀每個公布欄的名稱（只讀群組本身，不讀白板內容，資料量很小） */
export function useGroupNames(gids: string[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const unsubs = gids.map((gid) => watchGroupName(gid, (name) => setNames((n) => ({ ...n, [gid]: name }))));
    return () => unsubs.forEach((u) => u());
  }, [gids]);
  return names;
}
