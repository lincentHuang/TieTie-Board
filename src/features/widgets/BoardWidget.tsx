import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  opacity,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetView } from './widget-data';

/**
 * iOS 桌面 / 鎖定畫面小工具。
 * 注意：'widget' 函式在獨立環境執行，不能使用外部變數、hooks 或 import 的函式，
 * 所有要顯示的文字都由 App 事先算好（見 ./widget-data.ts）。
 */
const BoardWidget = (props: WidgetView, env: WidgetEnvironment) => {
  'widget';
  const colors = { urgent: '#FF5A6E', important: '#FF9F43', none: '#9A7FE0' };
  const bg = colors[props.focusPriority] ?? colors.none;
  const family = env.widgetFamily;
  const hasDue = props.focusDueAt > 0;
  const dueDate = new Date(props.focusDueAt);

  if (family === 'accessoryInline') {
    return <Text>{props.pendingCount > 0 ? `⚠︎ ${props.focusTitle}` : props.focusTitle}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <VStack spacing={0}>
        <Image systemName={props.pendingCount > 0 ? 'megaphone.fill' : 'calendar'} size={18} />
        {props.pendingCount > 0 ? (
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{props.pendingCount}</Text>
        ) : hasDue ? (
          <Text modifiers={[font({ size: 11 })]} date={dueDate} dateStyle="time" />
        ) : null}
      </VStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[frame({ maxWidth: 1000, alignment: 'leading' })]}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), lineLimit(1)]}>{props.focusBadge}</Text>
        <Text modifiers={[font({ size: 16, weight: 'heavy' }), lineLimit(2)]}>{props.focusTitle}</Text>
        {hasDue ? <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{props.focusWhen}</Text> : null}
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  const medium = family === 'systemMedium';
  const xl = family === 'systemExtraLarge';
  const titleSize = small ? 22 : medium ? 28 : xl ? 60 : 40;
  const upcoming = small || medium ? [] : props.upcoming.slice(0, xl ? 4 : 3);

  return (
    <VStack
      alignment="leading"
      spacing={small ? 4 : 6}
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }),
        containerBackground(bg, 'widget'),
      ]}>
      <HStack>
        <Text
          modifiers={[
            font({ size: small ? 11 : 14, weight: 'bold' }),
            foregroundStyle('#FFFFFF'),
            lineLimit(1),
          ]}>
          {props.focusBadge}
        </Text>
        <Spacer />
        {small ? null : (
          <Text modifiers={[font({ size: 12 }), foregroundStyle('#FFFFFF'), opacity(0.7), lineLimit(1)]}>
            {props.groupName}
          </Text>
        )}
      </HStack>

      <Spacer minLength={0} />

      <Text
        modifiers={[
          font({ size: titleSize, weight: 'black' }),
          foregroundStyle('#FFFFFF'),
          minimumScaleFactor(0.4),
          lineLimit(small ? 4 : 3),
        ]}>
        {props.focusTitle}
      </Text>

      {hasDue ? (
        <HStack spacing={6}>
          <Text
            modifiers={[font({ size: small ? 13 : 17, weight: 'semibold' }), foregroundStyle('#FFFFFF')]}>
            {props.focusWhen}
          </Text>
          {small ? null : (
            <Text
              date={dueDate}
              dateStyle="relative"
              modifiers={[font({ size: 15 }), foregroundStyle('#FFFFFF'), opacity(0.8), lineLimit(1)]}
            />
          )}
        </HStack>
      ) : null}

      <Spacer minLength={0} />

      {upcoming.length > 0 ? (
        <VStack alignment="leading" spacing={3}>
          {medium ? null : (
            <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle('#FFFFFF'), opacity(0.7)]}>
              接下來
            </Text>
          )}
          {upcoming.map((u, i) => (
            <HStack key={i} spacing={8}>
              <Text
                modifiers={[
                  font({ size: xl ? 18 : 14, weight: 'semibold' }),
                  foregroundStyle(u.urgent ? '#FFD6D6' : '#FFFFFF'),
                  lineLimit(1),
                ]}>
                {u.when}
              </Text>
              <Text modifiers={[font({ size: xl ? 18 : 14 }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>
                {u.title}
              </Text>
            </HStack>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
};

export default createWidget<WidgetView>('BoardWidget', BoardWidget);
