import { useEffect, useState } from 'react';

import { resetAlertPresets, saveAlertPresets, watchAlertPresets } from '@/lib/repo';
import type { AlertPreset } from '@/lib/types';

import { DEFAULT_ALERT_PRESETS } from './presets';

/**
 * 自己的快速通報按鈕（存在帳號上，換手機也一樣）。
 * presets 是 null = 還在讀；沒設定過或讀不到（例如權限規則還沒部署）就用預設的按鈕
 */
export function useAlertPresets(uid: string) {
  const [presets, setPresets] = useState<AlertPreset[] | null>(null);
  const [custom, setCustom] = useState(false);

  useEffect(
    () =>
      watchAlertPresets(
        uid,
        (list) => {
          setPresets(list ?? DEFAULT_ALERT_PRESETS);
          setCustom(list !== null);
        },
        (e) => {
          console.warn('讀取快速通報按鈕失敗，先用預設的', e);
          setPresets(DEFAULT_ALERT_PRESETS);
        },
      ),
    [uid],
  );

  return {
    presets,
    /** 自己改過（可以恢復預設） */
    custom,
    save: (list: AlertPreset[]) => saveAlertPresets(uid, list),
    reset: () => resetAlertPresets(uid),
  };
}
