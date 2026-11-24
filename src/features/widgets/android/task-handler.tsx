import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { refreshWidgetFromServer } from '../refresh';
import { stepView, viewAt } from '../widget-data';
import { BoardAndroidWidget, NEXT_PAGE, PREV_PAGE, REFRESH, rowsFit } from './BoardAndroidWidget';
import { loadPick, loadSource, loadSyncedAt, removePick, savePick } from './storage';

/**
 * 定時更新（每 30 分鐘）只用存著的資料重畫；離上次拿到最新資料超過這麼久才去資料庫抓。
 * 平常有變化都會送推播來更新，這只是補漏掉的推播。
 */
const PERIODIC_FETCH_GAP = 2 * 3_600_000;
/** 按 ↻ 時，這麼短的時間內剛更新過就不再抓（避免連按一直打資料庫） */
const TAP_FETCH_GAP = 30_000;

/** 系統要求更新小工具時（新增、每 30 分鐘、拉伸大小、按下按鈕）在背景執行 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps) {
  const { widgetId, width, height } = widgetInfo;
  if (widgetAction === 'WIDGET_DELETED') return removePick(widgetId);

  const now = Date.now();
  const source = await loadSource();
  let pick = await loadPick(widgetId);
  const render = async (refreshing = false) =>
    renderWidget(
      <BoardAndroidWidget
        view={viewAt(await loadSource(), Date.now(), pick)}
        width={width}
        height={height}
        refreshing={refreshing}
      />,
    );

  if (widgetAction === 'WIDGET_CLICK' && clickAction === REFRESH) {
    if (now - (await loadSyncedAt()) < TAP_FETCH_GAP) return render();
    await render(true);
    await refreshWidgetFromServer().catch((e) => console.warn('小工具抓最新資料失敗', e));
    // 抓成功時其實已經重畫過了；沒登入、沒網路時也要把「更新中…」拿掉
    return render();
  }

  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction !== PREV_PAGE && clickAction !== NEXT_PAGE) return;
    const view = viewAt(source, now, pick);
    const page = view.pages[view.index];
    if (!page) return;
    // ‹ › 先翻這個公布欄的下一批未讀，翻完才換公布欄
    const next = stepView(view, clickAction === NEXT_PAGE ? 1 : -1, rowsFit(page, width, height));
    if (!next) return;
    pick = { ...next, at: now };
    await savePick(widgetId, pick);
  }
  await render();

  if (widgetAction === 'WIDGET_UPDATE' && now - (await loadSyncedAt()) >= PERIODIC_FETCH_GAP) {
    await refreshWidgetFromServer().catch((e) => console.warn('小工具抓最新資料失敗', e));
  }
}
