import { useEffect, useState } from 'react';

import { watchEditRequests } from '@/lib/repo';
import type { BoardItem, EditRequest } from '@/lib/types';

type Requests = { incoming: EditRequest[]; outgoing: EditRequest[] };
const EMPTY: Requests = { incoming: [], outgoing: [] };

/**
 * 跟我有關的編輯申請：別人想改我貼的（incoming，等我同意）、我想改別人的（outgoing，等對方同意）。
 * 項目已經刪掉的申請不算（房主刪掉別人的項目時，申請會留在資料庫裡，但沒有用了）
 */
export function useEditRequests(gid: string, uid: string, items: BoardItem[] | null): Requests {
  // 記下是哪個公布欄的，切換公布欄時不會先閃一下上一個的申請
  const [state, setState] = useState<Requests & { gid: string }>({ gid, ...EMPTY });

  useEffect(() => watchEditRequests(gid, uid, (r) => setState({ gid, ...r })), [gid, uid]);

  if (state.gid !== gid || !items) return EMPTY;
  const alive = (r: EditRequest) => items.some((i) => i.id === r.itemId);
  return { incoming: state.incoming.filter(alive), outgoing: state.outgoing.filter(alive) };
}
