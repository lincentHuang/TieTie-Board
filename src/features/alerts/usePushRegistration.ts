import { useEffect } from 'react';

import { getDevicePushTarget } from '@/lib/push';
import { savePushToken } from '@/lib/repo';

/** 這次打開 App 已經寫過的「公布欄:推播代碼」，切換公布欄時不用再寫一次 */
const saved = new Set<string>();

/** 把這台裝置的推播代碼記到每個加入的公布欄，別人發快速通報時才找得到我（網頁版不會做任何事） */
export function usePushRegistration(uid: string, gids: string[]) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const target = await getDevicePushTarget();
      if (!target || cancelled) return;
      await Promise.all(
        gids
          .filter((gid) => !saved.has(`${gid}:${target.token}`))
          .map(async (gid) => {
            await savePushToken(gid, uid, target.token, target.os);
            saved.add(`${gid}:${target.token}`);
          }),
      );
    })().catch((e) => console.warn('註冊推播失敗', e));
    return () => {
      cancelled = true;
    };
  }, [uid, gids]);
}
