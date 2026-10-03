import { firebaseConfigured, signedInUid } from '@/lib/firebase';
import { fetchBoardDigest } from '@/lib/repo';
import { loadSavedGroupIds } from '@/lib/session';

import { buildWidgetSource } from './widget-data';
import { syncWidget } from './widget-sync';

let running: Promise<void> | null = null;

/**
 * 不靠畫面、直接從資料庫抓所有公布欄的最新內容更新小工具。
 * App 在背景收到推播、Android 小工具定時更新時呼叫；同時被叫好幾次只會跑一次。
 */
export function refreshWidgetFromServer() {
  running ??= (async () => {
    try {
      if (!firebaseConfigured) return;
      const [uid, gids] = await Promise.all([signedInUid(), loadSavedGroupIds()]);
      if (!uid || gids.length === 0) return;
      const results = await Promise.allSettled(gids.map(fetchBoardDigest));
      const digests = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      await syncWidget(buildWidgetSource(digests, uid));
    } finally {
      running = null;
    }
  })();
  return running;
}
