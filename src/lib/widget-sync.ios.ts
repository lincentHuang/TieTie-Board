import BoardWidget from '@/widgets/BoardWidget';

import { nextMidnights } from './dates';
import { viewAt, type WidgetSource } from './widget-data';

const KEEP_AFTER_START = 3_600_000;
const MAX_ENTRIES = 30;

/**
 * 產生一條時間軸：現在、每個活動開始 / 結束、每天午夜，各算一次畫面。
 * 這樣就算 App 沒打開，小工具也會自動把過期的活動換掉，「明天」也會準時變「今天」。
 */
export async function syncWidget(source: WidgetSource) {
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
