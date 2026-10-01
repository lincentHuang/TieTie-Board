import { isRunningInExpoGo } from 'expo';

import { nextMidnights } from '@/lib/dates';

import { KEEP_AFTER_START, viewAt, type WidgetSource } from './widget-data';

const MAX_ENTRIES = 30;

// Expo Go 沒有小工具的原生模組，一 import 就會閃退，所以只在 development build / 正式版才載入
const BoardWidget: typeof import('./BoardWidget').default | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- 要依環境決定載不載，不能用 import
    require('./BoardWidget').default;

/**
 * 產生一條時間軸：現在、每個活動開始 / 結束、每天午夜，各算一次畫面。
 * 這樣就算 App 沒打開，小工具也會自動把過期的活動換掉，「明天」也會準時變「今天」。
 */
export async function syncWidget(source: WidgetSource) {
  if (!BoardWidget) return;
  const now = Date.now();
  const moments = new Set<number>([now, ...nextMidnights(7, now)]);
  for (const e of source.events) {
    if (e.dueAt > now) moments.add(e.dueAt);
    if (e.dueAt + KEEP_AFTER_START > now) moments.add(e.dueAt + KEEP_AFTER_START);
  }
  const entries = [...moments]
    .sort((a, b) => a - b)
    .slice(0, MAX_ENTRIES)
    .map((t) => ({ date: new Date(t), props: viewAt(source, t) }));
  BoardWidget.updateTimeline(entries);
}
