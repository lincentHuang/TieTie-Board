// react-native-android-widget 把元件當一般函式呼叫（不是 React 渲染），React Compiler 加的快取 hook 會讓它直接報錯，
// 所以這個檔案不讓 React Compiler 處理
'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { pageColor, type WidgetView } from '../widget-data';

/** 小工具上的按鈕：上一個 / 下一個公布欄（由 task-handler 處理） */
export const PREV_BOARD = 'PREV_BOARD';
export const NEXT_BOARD = 'NEXT_BOARD';

type Hex = `#${string}`;
const WHITE: Hex = '#FFFFFF';
const DIM = 'rgba(255, 255, 255, 0.75)' as const;
const CHIP = 'rgba(255, 255, 255, 0.22)' as const;

function Arrow({ action, label }: { action: string; label: string }) {
  return (
    <FlexWidget
      clickAction={action}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CHIP, justifyContent: 'center', alignItems: 'center' }}>
      <TextWidget text={label} style={{ fontSize: 20, fontWeight: 'bold', color: WHITE }} />
    </FlexWidget>
  );
}

/** Android 桌面小工具：每個公布欄一頁，‹ › 切換；依照拉伸後的大小自動調整字級 */
export function BoardAndroidWidget({ view, width, height }: { view: WidgetView; width: number; height: number }) {
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

  const compact = height < 150 || width < 200;
  const big = height > 320 && width > 300;
  const titleSize = compact ? 22 : big ? 44 : 32;
  const alerting = page.alertText !== '';
  const many = view.pages.length > 1;
  const upcoming = compact || alerting ? [] : page.upcoming.slice(0, big ? 4 : 2);
  const alertTime = new Date(page.alertAt);
  const hhmm = `${String(alertTime.getHours()).padStart(2, '0')}:${String(alertTime.getMinutes()).padStart(2, '0')}`;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: page.url }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: pageColor(page) as Hex,
        borderRadius: 24,
        padding: 14,
      }}>
      {/* 頂部：切換公布欄、名稱、快速通報 */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        {many ? <Arrow action={PREV_BOARD} label="‹" /> : null}
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginHorizontal: many ? 8 : 0 }}>
          <TextWidget
            text={page.groupName}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 15, fontWeight: 'bold', color: WHITE }}
          />
          {many ? (
            <TextWidget text={`${view.index + 1} / ${view.pages.length}`} style={{ fontSize: 11, color: DIM }} />
          ) : null}
        </FlexWidget>
        {many ? <Arrow action={NEXT_BOARD} label="›" /> : null}
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
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
          <TextWidget
            text={`📣 ${page.alertBy} 通報・${hhmm}`}
            maxLines={1}
            style={{ fontSize: compact ? 12 : 14, fontWeight: 'bold', color: WHITE }}
          />
          <TextWidget
            text={`${page.alertEmoji} ${page.alertText}`}
            maxLines={compact ? 2 : 3}
            truncate="END"
            style={{ fontSize: titleSize, fontWeight: '900', color: WHITE, marginTop: 2 }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
          <TextWidget text={page.focusBadge} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold', color: DIM }} />
          <TextWidget
            text={page.focusTitle}
            maxLines={compact ? 2 : 3}
            truncate="END"
            style={{ fontSize: titleSize, fontWeight: '900', color: WHITE }}
          />
          {page.focusWhen ? (
            <TextWidget
              text={`${page.focusWhen}　${page.focusCountdown}`}
              maxLines={1}
              style={{ fontSize: compact ? 13 : 17, fontWeight: '600', color: WHITE, marginTop: 4 }}
            />
          ) : null}
        </FlexWidget>
      )}

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
        {upcoming.length > 0 ? (
          <TextWidget text="接下來" style={{ fontSize: 12, fontWeight: 'bold', color: DIM }} />
        ) : null}
        {upcoming.map((u, i) => (
          <TextWidget
            key={i}
            text={`${u.when}　${u.title}`}
            maxLines={1}
            truncate="END"
            style={{ fontSize: big ? 16 : 14, color: u.urgent ? '#FFD6D6' : WHITE, marginTop: 2 }}
          />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
