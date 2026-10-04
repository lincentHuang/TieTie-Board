import { useEffect, useState } from 'react';

import { watchJoinRequests } from '@/lib/repo';
import type { JoinRequest } from '@/lib/types';

/** 等房主同意的加入申請：只有房主會訂閱（別人讀不到，規則也會擋） */
export function useJoinRequests(gid: string, isOwner: boolean) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!isOwner) return;
    return watchJoinRequests(gid, setRequests);
  }, [gid, isOwner]);

  return isOwner ? requests : [];
}
