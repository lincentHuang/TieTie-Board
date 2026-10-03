import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  opacity,
  padding,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetView } from './widget-data';

/**
 * iOS 桌面 / 鎖定畫面小工具：每個公布欄一頁，用 ‹ › 或下面的分頁切換（iOS 17 以上）。
 * 注意：'widget' 函式在獨立環境執行，不能使用外部變數、hooks 或 import 的函式，
 * 所有要顯示的文字都由 App 事先算好（見 ./widget-data.ts）。
 * 按鈕的 onPress 也在小工具裡執行，回傳的值會直接成為新的 props，不需要打開 App。
 */
const BoardWidget = (props: WidgetView, env: WidgetEnvironment) => {
  'widget';
  const family = env.widgetFamily;
  const pages = props.pages ?? [];
  const count = pages.length;
  const index = props.index >= 0 && props.index < count ? props.index : 0;
  const page = pages[index];
  const white = '#FFFFFF';

  if (!page) {
    return (
      <VStack modifiers={[containerBackground('#9A7FE0', 'widget')]}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(white)]}>打開 App 加入公布欄</Text>
      </VStack>
    );
  }

  const alerting = page.alertText !== '';
  const focusColors = { urgent: '#FF5A6E', important: '#FF9F43', none: '#9A7FE0' };
  const bg = alerting ? (page.alertUrgent ? '#FF3B5C' : '#FF6FA3') : (focusColors[page.focusPriority] ?? focusColors.none);
  const hasDue = page.focusDueAt > 0;
  const dueDate = new Date(page.focusDueAt);
  const alertLine = `${page.alertEmoji} ${page.alertText}`;
  /** 切換公布欄：記下切換的時間，比它更舊的通報就不會再把畫面搶走 */
  const go = (step: number) => ({ index: (index + step + count) % count, pickedAt: Date.now() });
  const pick = (i: number) => ({ index: i, pickedAt: Date.now() });

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[widgetURL(page.url)]}>
        {alerting ? `📣 ${page.alertBy}：${page.alertText}` : page.pendingCount > 0 ? `⚠︎ ${page.focusTitle}` : page.focusTitle}
      </Text>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL(page.url)]}>
        <Image systemName={alerting || page.pendingCount > 0 ? 'megaphone.fill' : 'calendar'} size={18} />
        {alerting ? (
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>!</Text>
        ) : page.pendingCount > 0 ? (
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{page.pendingCount}</Text>
        ) : hasDue ? (
          <Text modifiers={[font({ size: 11 })]} date={dueDate} dateStyle="time" />
        ) : null}
      </VStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack
        alignment="leading"
        spacing={1}
        modifiers={[frame({ maxWidth: 1000, alignment: 'leading' }), widgetURL(page.url)]}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), lineLimit(1)]}>
          {alerting ? `📣 ${page.alertBy}・${page.groupName}` : page.focusBadge}
        </Text>
        <Text modifiers={[font({ size: 16, weight: 'heavy' }), lineLimit(2)]}>
          {alerting ? alertLine : page.focusTitle}
        </Text>
        {!alerting && hasDue ? <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{page.focusWhen}</Text> : null}
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  const medium = family === 'systemMedium';
  const xl = family === 'systemExtraLarge';
  const large = !small && !medium;
  const titleSize = small ? 22 : medium ? 28 : xl ? 60 : 40;
  // 小、中尺寸空間有限：通報中就整個換成通報內容
  const showFocus = !alerting || large;
  const upcoming = small || medium || alerting ? [] : page.upcoming.slice(0, xl ? 4 : 3);
  const tabs = large && count > 1 ? pages.slice(0, xl ? 6 : 4) : [];

  const arrow = (step: number, target: string) => (
    <Button target={target} onPress={() => go(step)} modifiers={[buttonStyle('plain')]}>
      <Image
        systemName={step < 0 ? 'chevron.left.circle.fill' : 'chevron.right.circle.fill'}
        size={small ? 20 : 22}
        color={white}
      />
    </Button>
  );

  return (
    <VStack
      alignment="leading"
      spacing={small ? 4 : 6}
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }),
        containerBackground(bg, 'widget'),
        widgetURL(page.url),
      ]}>
      {/* 頂部：公布欄名稱、切換、通報 */}
      <HStack spacing={6}>
        {!small && count > 1 ? arrow(-1, 'prev') : null}
        <Text
          modifiers={[font({ size: small ? 12 : 14, weight: 'bold' }), foregroundStyle(white), lineLimit(1)]}>
          {page.groupName}
        </Text>
        {count > 1 ? (
          <Text modifiers={[font({ size: small ? 11 : 12 }), foregroundStyle(white), opacity(0.7)]}>
            {`${index + 1}/${count}`}
          </Text>
        ) : null}
        {!small && count > 1 ? arrow(1, 'next') : null}
        <Spacer />
        {small ? (
          count > 1 ? (
            arrow(1, 'next')
          ) : null
        ) : (
          <Link destination={page.alertUrl}>
            <Text
              modifiers={[
                font({ size: 13, weight: 'bold' }),
                foregroundStyle(white),
                padding({ horizontal: 10, vertical: 5 }),
                background('#FFFFFF33', shapes.capsule()),
              ]}>
              📣 通報
            </Text>
          </Link>
        )}
      </HStack>

      {/* 快速通報 */}
      {alerting ? (
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={
            large
              ? [
                  frame({ maxWidth: 10000, alignment: 'leading' }),
                  padding({ all: 10 }),
                  background('#FFFFFF2E', shapes.roundedRectangle({ cornerRadius: 16 })),
                ]
              : []
          }>
          <HStack spacing={4}>
            <Text modifiers={[font({ size: small ? 11 : 13, weight: 'bold' }), foregroundStyle(white), lineLimit(1)]}>
              {`📣 ${page.alertBy} 通報`}
            </Text>
            <Text
              date={new Date(page.alertAt)}
              dateStyle="time"
              modifiers={[font({ size: small ? 11 : 13 }), foregroundStyle(white), opacity(0.8)]}
            />
          </HStack>
          <Text
            modifiers={[
              font({ size: large ? (xl ? 34 : 24) : titleSize, weight: 'black' }),
              foregroundStyle(white),
              minimumScaleFactor(0.4),
              lineLimit(small ? 4 : 2),
            ]}>
            {alertLine}
          </Text>
        </VStack>
      ) : null}

      <Spacer minLength={0} />

      {showFocus ? (
        <VStack alignment="leading" spacing={small ? 2 : 4}>
          <Text
            modifiers={[
              font({ size: small ? 11 : 13, weight: 'bold' }),
              foregroundStyle(white),
              opacity(0.85),
              lineLimit(1),
            ]}>
            {page.focusBadge}
          </Text>
          <Text
            modifiers={[
              font({ size: alerting ? 24 : titleSize, weight: 'black' }),
              foregroundStyle(white),
              minimumScaleFactor(0.4),
              lineLimit(small ? 4 : alerting ? 2 : 3),
            ]}>
            {page.focusTitle}
          </Text>
          {hasDue ? (
            <HStack spacing={6}>
              <Text
                modifiers={[font({ size: small ? 13 : 17, weight: 'semibold' }), foregroundStyle(white)]}>
                {page.focusWhen}
              </Text>
              {small ? null : (
                <Text
                  date={dueDate}
                  dateStyle="relative"
                  modifiers={[font({ size: 15 }), foregroundStyle(white), opacity(0.8), lineLimit(1)]}
                />
              )}
            </HStack>
          ) : null}
        </VStack>
      ) : null}

      <Spacer minLength={0} />

      {upcoming.length > 0 ? (
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(white), opacity(0.7)]}>接下來</Text>
          {upcoming.map((u, i) => (
            <HStack key={i} spacing={8}>
              <Text
                modifiers={[
                  font({ size: xl ? 18 : 14, weight: 'semibold' }),
                  foregroundStyle(u.urgent ? '#FFD6D6' : white),
                  lineLimit(1),
                ]}>
                {u.when}
              </Text>
              <Text modifiers={[font({ size: xl ? 18 : 14 }), foregroundStyle(white), lineLimit(1)]}>
                {u.title}
              </Text>
            </HStack>
          ))}
        </VStack>
      ) : null}

      {/* 大尺寸：每個公布欄一個分頁，有通報 / 未確認的會標出來 */}
      {tabs.length > 0 ? (
        <HStack spacing={6}>
          {tabs.map((p, i) => (
            <Button key={p.gid} target={`tab-${i}`} onPress={() => pick(i)} modifiers={[buttonStyle('plain')]}>
              <Text
                modifiers={[
                  font({ size: 13, weight: i === index ? 'bold' : 'medium' }),
                  foregroundStyle(i === index ? bg : white),
                  lineLimit(1),
                  padding({ horizontal: 10, vertical: 5 }),
                  background(i === index ? white : '#FFFFFF33', shapes.capsule()),
                ]}>
                {p.alertText ? `📣 ${p.groupName}` : p.pendingCount > 0 ? `${p.groupName}・${p.pendingCount}` : p.groupName}
              </Text>
            </Button>
          ))}
        </HStack>
      ) : null}
    </VStack>
  );
};

export default createWidget<WidgetView>('BoardWidget', BoardWidget);
