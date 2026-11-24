// react-native-android-widget 把元件當一般函式呼叫（不是 React 渲染），React Compiler 加的快取 hook 會讓它直接報錯，
// 所以這個檔案不讓 React Compiler 處理
'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { pageColor, type WidgetPage, type WidgetView } from '../widget-data';

/** 小工具上的按鈕：上一頁 / 下一頁未讀（翻完會換公布欄，由 task-handler 處理） */
export const PREV_PAGE = 'PREV_PAGE';
export const NEXT_PAGE = 'NEXT_PAGE';
/** 小工具上的 ↻：在背景去資料庫抓最新內容 */
export const REFRESH = 'REFRESH';

type Hex = `#${string}`;
const WHITE: Hex = '#FFFFFF';
const DIM = 'rgba(255, 255, 255, 0.75)' as const;
const CHIP = 'rgba(255, 255, 255, 0.22)' as const;

const isCompact = (width: number, height: number) => height < 150 || width < 200;
const isBig = (width: number, height: number) => height > 320 && width > 300;
const rowHeight = (width: number, height: number) => (isCompact(width, height) ? 24 : isBig(width, height) ? 34 : 30);

/** 依小工具大小算一頁放得下幾則未讀（task-handler 翻頁時也用這個） */
export function rowsFit(page: WidgetPage, width: number, height: number) {
  const compact = isCompact(width, height);
  const alertBlock = page.alertText ? (compact ? 56 : 84) : 0;
  const free = height - 28 - 44 - alertBlock;
  return Math.max(1, Math.floor(free / rowHeight(width, height)));
}

function Arrow({ action, label }: { action: string; label: string }) {
  return (
    <FlexWidget
      clickAction={action}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CHIP, justifyContent: 'center', alignItems: 'center' }}>
      <TextWidget text={label} style={{ fontSize: 20, fontWeight: 'bold', color: WHITE }} />
    </FlexWidget>
  );
}

/** Android 桌面小工具：列出每個公布欄還沒確認的公告，‹ › 翻下一批，翻完換下一個公布欄 */
export function BoardAndroidWidget({
  view,
  width,
  height,
  refreshing = false,
}: {
  view: WidgetView;
  width: number;
  height: number;
  /** 按了 ↻、正在抓資料：副標題換成「更新中…」 */
  refreshing?: boolean;
}) {
  const page = view.pages[view.index];
  if (!page) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: '#9A7FE0',
          borderRadius: 24,
          padding: 16,
          justifyContent: 'center',
        }}>
        <TextWidget text="打開 App 加入公布欄" style={{ fontSize: 18, fontWeight: 'bold', color: WHITE }} />
      </FlexWidget>
    );
  }

  const compact = isCompact(width, height);
  const big = isBig(width, height);
  const alerting = page.alertText !== '';
  const size = rowsFit(page, width, height);
  const n = page.unread.length;
  const start = Math.floor(view.offset / size) * size;
  const rows = page.unread.slice(start, start + size);
  const chunks = Math.ceil(n / size);
  const showArrows = view.pages.length > 1 || n > size;
  const alertTime = new Date(page.alertAt);
  const hhmm = `${String(alertTime.getHours()).padStart(2, '0')}:${String(alertTime.getMinutes()).padStart(2, '0')}`;
  const sub = refreshing ? '更新中…' : [
    page.unreadCount > 0 ? `${page.unreadCount} 則未讀` : '都看過了',
    chunks > 1 ? `第 ${Math.floor(start / size) + 1}/${chunks} 頁` : '',
    view.pages.length > 1 ? `公布欄 ${view.index + 1}/${view.pages.length}` : '',
  ]
    .filter(Boolean)
    .join('・');
  const refreshButton = <Arrow action={REFRESH} label="↻" />;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: page.url }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: pageColor(page) as Hex,
        borderRadius: 24,
        padding: 14,
      }}>
      {/* 頂部：翻頁、名稱、快速通報 */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        {showArrows ? <Arrow action={PREV_PAGE} label="‹" /> : null}
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginHorizontal: showArrows ? 8 : 0 }}>
          <TextWidget
            text={page.groupName}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 15, fontWeight: 'bold', color: WHITE }}
          />
          <TextWidget text={sub} maxLines={1} truncate="END" style={{ fontSize: 11, color: DIM }} />
        </FlexWidget>
        {showArrows ? <Arrow action={NEXT_PAGE} label="›" /> : null}
        <FlexWidget style={{ marginLeft: 8 }}>{refreshButton}</FlexWidget>
        {compact ? null : (
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: page.alertUrl }}
            style={{ marginLeft: 8, height: 36, borderRadius: 18, backgroundColor: CHIP, paddingHorizontal: 12, justifyContent: 'center' }}>
            <TextWidget text="📣 通報" style={{ fontSize: 14, fontWeight: 'bold', color: WHITE }} />
          </FlexWidget>
        )}
      </FlexWidget>

      {alerting ? (
        <FlexWidget
          style={{ width: 'match_parent', flexDirection: 'column', marginTop: 8, padding: 8, borderRadius: 14, backgroundColor: CHIP }}>
          <TextWidget
            text={`📣 ${page.alertBy} 通報・${hhmm}`}
            maxLines={1}
            style={{ fontSize: compact ? 12 : 13, fontWeight: 'bold', color: WHITE }}
          />
          <TextWidget
            text={`${page.alertEmoji} ${page.alertText}`}
            maxLines={compact ? 1 : 2}
            truncate="END"
            style={{ fontSize: compact ? 16 : 20, fontWeight: '900', color: WHITE }}
          />
        </FlexWidget>
      ) : null}

      {/* 未讀清單 */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 6 }}>
        {n === 0 ? (
          <TextWidget
            text="✓ 公告都看過了"
            style={{ fontSize: compact ? 18 : big ? 26 : 22, fontWeight: '900', color: WHITE, marginTop: 4 }}
          />
        ) : (
          rows.map((r, i) => (
            <FlexWidget
              key={start + i}
              style={{ width: 'match_parent', height: rowHeight(width, height), flexDirection: 'row', alignItems: 'center' }}>
              <FlexWidget
                style={{ width: 8, height: 8, borderRadius: 4, marginRight: 8, backgroundColor: r.priority === 'urgent' ? '#FFD6D6' : WHITE }}
              />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={r.title}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: compact ? 14 : big ? 18 : 16, fontWeight: 'bold', color: WHITE }}
                />
              </FlexWidget>
              {r.when ? (
                <TextWidget text={r.when} maxLines={1} style={{ fontSize: compact ? 12 : 13, color: DIM, marginLeft: 6 }} />
              ) : null}
            </FlexWidget>
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
