import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { showError } from '@/components/dialogs';
import { joinGroup } from '@/lib/repo';
import { useSession } from '@/lib/session';

/**
 * 從邀請連結打開（?join=邀請碼，通常是在 LINE 群組裡點的）：
 * - 已經加入過 → 切過去
 * - 已經有名字（用 LINE 登入，或之前取過暱稱）→ 直接加入
 * - 還沒有名字 → 不處理，交給設定畫面（邀請碼會先填好）
 * 回傳 true = 正在加入，畫面先顯示載入中
 */
export function useJoinFromLink(code: string | null) {
  const session = useSession();
  const started = useRef<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ready = session.status === 'ready';
  const member = code !== null && session.groupIds.includes(code);
  const name = session.nickname;

  useEffect(() => {
    if (!ready || !code || started.current === code) return;
    // 參數用完就清掉，重新整理或下次點同一個連結才不會重複加入
    const done = () => router.setParams({ join: undefined, 'liff.state': undefined });
    if (member) {
      started.current = code;
      session
        .switchGroup(code)
        .catch((e) => console.warn('切換公布欄失敗', e))
        .finally(done);
      return;
    }
    if (!name) return;
    started.current = code;
    (async () => {
      try {
        const ok = await joinGroup(code, session.uid, { name, avatarUrl: session.avatarUrl });
        if (!ok) throw new Error('找不到這個公布欄，可能已經被刪掉了');
        await session.enterGroup(code, name);
      } catch (e) {
        setFailed(code);
        showError('加入公布欄失敗', e);
      } finally {
        done();
      }
    })();
  }, [code, member, name, ready, session]);

  return ready && code !== null && code !== failed && !member && Boolean(name);
}
