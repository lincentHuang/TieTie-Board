import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { FOCUS_COLORS, type WidgetView } from '@/lib/widget-data';

type Hex = `#${string}`;
const WHITE: Hex = '#FFFFFF';
const DIM = 'rgba(255, 255, 255, 0.75)' as const;

/** Android 桌面小工具，依照拉伸後的大小自動調整字級 */
export function BoardAndroidWidget({ view, width, height }: { view: WidgetView; width: number; height: number }) {
  const compact = height < 150 || width < 200;
  const big = height > 320 && width > 300;
  const titleSize = compact ? 22 : big ? 44 : 32;
  const upcoming = compact ? [] : view.upcoming.slice(0, big ? 4 : 2);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: FOCUS_COLORS[view.focusPriority] as Hex,
        borderRadius: 24,
        padding: 16,
      }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextWidget text={view.focusBadge} maxLines={1} style={{ fontSize: 14, fontWeight: 'bold', color: WHITE }} />
        {compact ? null : (
          <TextWidget text={view.groupName} maxLines={1} style={{ fontSize: 12, color: DIM }} />
        )}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
        <TextWidget
          text={view.focusTitle}
          maxLines={compact ? 2 : 3}
          truncate="END"
          style={{ fontSize: titleSize, fontWeight: '900', color: WHITE }}
        />
        {view.focusWhen ? (
          <TextWidget
            text={`${view.focusWhen}　${view.focusCountdown}`}
            maxLines={1}
            style={{ fontSize: compact ? 13 : 17, fontWeight: '600', color: WHITE, marginTop: 4 }}
          />
        ) : null}
      </FlexWidget>

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
