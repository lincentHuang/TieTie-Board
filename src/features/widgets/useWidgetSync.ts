import { useEffect } from 'react';

import type { BoardDigest } from '@/lib/types';

import { buildWidgetSource } from './widget-data';
import { syncWidget } from './widget-sync';

let lastSignature = '';

/**
 * App 開著時：任何公布欄的公告、活動、通報一有變化，馬上更新桌面小工具。
 * 不用 setTimeout 延遲合併：Android 的 App 在背景時計時器會暫停，小工具就不會更新了
 * （所有公布欄到齊前 digests 是 null，一開始不會連寫好幾次）。
 */
export function useWidgetSync(digests: BoardDigest[] | null, uid: string, currentGid: string) {
  useEffect(() => {
    if (!digests) return;
    const source = buildWidgetSource(digests, uid);
    // 拖曳便利貼之類的變化不影響小工具，內容一樣就不重寫
    const signature = JSON.stringify([source, currentGid]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    syncWidget(source, currentGid).catch((e) => console.warn('更新小工具失敗', e));
  }, [digests, uid, currentGid]);
}
