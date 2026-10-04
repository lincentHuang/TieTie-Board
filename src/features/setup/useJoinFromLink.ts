import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { showError, showNotice } from '@/components/dialogs';
import { joinBoard } from '@/lib/join';
import { useSession } from '@/lib/session';

/**
 * 從邀請連結打開（?join=邀請碼，通常是在 LINE 群組裡點的）：
 * - 已經加入過 → 切過去；已經送過申請 → 繼續等（例如剛在設定畫面按了「加入群組」）
 * - 已經有名字（用 LINE 登入，或之前取過暱稱）→ 加入：在房主綁定的 LINE 群組裡就直接加入，不然送出申請等房主同意
 * - 還沒有名字 → 不處理，交給設定畫面（邀請碼會先填好）
 * 回傳 true = 正在加入，畫面先顯示載入中
 */
export function useJoinFromLink(code: string | null) {
  const session = useSession();
  const started = useRef<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ready = session.status === 'ready';
  const member = code !== null && session.groupIds.includes(code);
  const pending = code !== null && session.pendingIds.includes(code);
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
    if (pending) {
      started.current = code;
      done();
      return;
    }
    if (!name) return;
    started.current = code;
    (async () => {
      try {
        const result = await joinBoard(code, session.uid, { name, avatarUrl: session.avatarUrl });
        if (result === 'missing') throw new Error('找不到這個公布欄，可能已經被刪掉了');
        if (result === 'joined') {
          await session.enterGroup(code, name);
          return;
        }
        await session.addPending(code, name);
        // 還沒有任何公布欄時，設定畫面上就看得到「等房主同意」，不用再跳提示
        if (session.groupId) showNotice('已送出加入申請', '房主同意後就會自動加入，可以在上方的公布欄清單看到');
      } catch (e) {
        setFailed(code);
        showError('加入公布欄失敗', e);
      } finally {
        done();
      }
    })();
  }, [code, member, pending, name, ready, session]);

  return ready && code !== null && code !== failed && !member && !pending && Boolean(name);
}
