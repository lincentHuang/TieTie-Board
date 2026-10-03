import { isRunningInExpoGo } from 'expo';

import { viewAt, widgetMoments, type BoardPick, type WidgetSource } from './widget-data';

// Expo Go 沒有小工具的原生模組，一 import 就會閃退，所以只在 development build / 正式版才載入
const BoardWidget: typeof import('./BoardWidget').default | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- 要依環境決定載不載，不能用 import
    require('./BoardWidget').default;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** 讀小工具現在顯示的那一格：使用者在小工具上切換過的公布欄要保留下來，不要被 App 蓋掉 */
async function shownPick(widget: NonNullable<typeof BoardWidget>, now: number): Promise<BoardPick | null> {
  try {
    const current = (await widget.getTimeline()).filter((e) => e.date.getTime() <= now).at(-1);
    // 舊版 App 存的格式不一樣，先當作不可信的資料檢查
    const props: unknown = current?.props;
    if (!isRecord(props) || !Array.isArray(props.pages) || typeof props.index !== 'number') return null;
    const page: unknown = props.pages[props.index];
    if (!isRecord(page) || typeof page.gid !== 'string') return null;
    return { gid: page.gid, at: typeof props.pickedAt === 'number' ? props.pickedAt : 0 };
  } catch {
    return null;
  }
}

/**
 * 把所有公布欄的資料寫進小工具的時間軸（見 widgetMoments），系統會在每個時間點自動換畫面。
 * currentGid：App 目前打開的公布欄；使用者沒在小工具上切換過時，小工具就跟著它。
 */
export async function syncWidget(source: WidgetSource, currentGid?: string) {
  if (!BoardWidget) return;
  const now = Date.now();
  const shown = await shownPick(BoardWidget, now);
  const pick = shown?.at ? shown : currentGid ? { gid: currentGid, at: 0 } : shown;
  BoardWidget.updateTimeline(
    widgetMoments(source, now).map((t) => ({ date: new Date(t), props: viewAt(source, t, pick) })),
  );
}
