import { useEffect, useState } from 'react';

import { watchBoardDigest } from './repo';
import type { BoardDigest } from './types';

/**
 * 同時即時訂閱所有加入的公布欄摘要（名稱、公告、活動、最近的通報），給桌面小工具與快速通報用。
 * 每個公布欄都回來（或讀取失敗）之前回傳 null，避免小工具先顯示不完整的清單。
 */
export function useBoardDigests(gids: string[]) {
  const [digests, setDigests] = useState<Record<string, BoardDigest | 'failed'>>({});

  useEffect(() => {
    const unsubs = gids.map((gid) =>
      watchBoardDigest(
        gid,
        (d) => setDigests((all) => ({ ...all, [gid]: d })),
        (e) => {
          // 例如已經被移出群組：這個公布欄就不顯示，其他照常
          console.warn('讀取公布欄摘要失敗', gid, e);
          setDigests((all) => ({ ...all, [gid]: 'failed' }));
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [gids]);

  if (gids.some((gid) => digests[gid] === undefined)) return null;
  return gids.flatMap((gid) => {
    const d = digests[gid];
    return d && d !== 'failed' ? [d] : [];
  });
}
