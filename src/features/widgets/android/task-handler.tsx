import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { refreshWidgetFromServer } from '../refresh';
import { viewAt, type WidgetView } from '../widget-data';
import { BoardAndroidWidget, NEXT_BOARD, PREV_BOARD } from './BoardAndroidWidget';
import { loadPick, loadSource, removePick, savePick } from './storage';

function clickedBoard(view: WidgetView, clickAction?: string) {
  const count = view.pages.length;
  if (count < 2) return null;
  if (clickAction === PREV_BOARD) return view.pages[(view.index - 1 + count) % count].gid;
  if (clickAction === NEXT_BOARD) return view.pages[(view.index + 1) % count].gid;
  return null;
}

/** 系統要求更新小工具時（新增、每 30 分鐘、拉伸大小、按下按鈕）在背景執行 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps) {
  const { widgetId } = widgetInfo;
  if (widgetAction === 'WIDGET_DELETED') return removePick(widgetId);

  const now = Date.now();
  const source = await loadSource();
  let pick = await loadPick(widgetId);
  if (widgetAction === 'WIDGET_CLICK') {
    const gid = clickedBoard(viewAt(source, now, pick), clickAction);
    if (!gid) return;
    pick = { gid, at: now };
    await savePick(widgetId, pick);
  }
  renderWidget(<BoardAndroidWidget view={viewAt(source, now, pick)} width={widgetInfo.width} height={widgetInfo.height} />);

  // 定時更新時順便從資料庫抓最新內容（抓到後會重畫所有小工具），App 沒打開也會是新的
  if (widgetAction === 'WIDGET_UPDATE') {
    await refreshWidgetFromServer().catch((e) => console.warn('小工具抓最新資料失敗', e));
  }
}
