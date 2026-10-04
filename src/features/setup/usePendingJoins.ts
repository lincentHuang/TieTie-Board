import { useEffect, useEffectEvent } from 'react';

import { showNotice } from '@/components/dialogs';
import { fetchGroup, watchJoinStatus } from '@/lib/repo';
import { useSession } from '@/lib/session';

/** 告訴使用者申請的結果（讀不到公布欄名稱就當作它被刪掉了） */
async function announce(gid: string, approved: boolean, opened: boolean) {
  const group = await fetchGroup(gid).catch(() => null);
  if (approved) {
    const name = group?.name ?? '公布欄';
    showNotice('房主同意了 🎉', opened ? `歡迎加入「${name}」！` : `已經加入「${name}」，點上方的公布欄名稱就能切換過去`);
  } else {
    showNotice('沒有加入成功', group ? `「${group.name}」的房主沒有同意這次的加入申請` : '這個公布欄已經不在了');
  }
}

/**
 * 等房主同意的公布欄：一有結果就處理（掛在首頁，不管現在在哪個畫面都收得到）
 * - 同意 → 加進我的公布欄（還沒打開任何公布欄就直接打開）
 * - 拒絕（或公布欄被刪掉）→ 從等待清單拿掉，告訴使用者
 */
export function usePendingJoins() {
  const session = useSession();
  const { status, uid, pendingIds } = session;

  const onResult = useEffectEvent((gid: string, approved: boolean) => {
    const opened = approved && session.groupId === null;
    session.settlePending(gid, approved);
    announce(gid, approved, opened).catch((e) => console.warn('顯示申請結果失敗', e));
  });

  useEffect(() => {
    if (status !== 'ready') return;
    const unsubs = pendingIds.map((gid) => {
      // 清單更新、重新訂閱之前，同一個結果可能又來一次
      let handled = false;
      return watchJoinStatus(gid, uid, (result) => {
        if (handled || result === 'pending') return;
        handled = true;
        onResult(gid, result === 'approved');
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [status, uid, pendingIds]);
}
