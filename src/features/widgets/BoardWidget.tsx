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

/** 「編輯小工具」的選項（app.json 的 configuration.parameters）：'all' 或 'b1'…'b8' */
interface BoardWidgetConfig {
  board?: string;
}

/**
 * iOS 桌面 / 鎖定畫面小工具：列出每個公布欄的公告，未讀的在上、已讀的在下（淡一點），已完成（封存）的不顯示；
 * ‹ › 先翻同一個公布欄的下一批，翻完換下一個公布欄（iOS 17 以上）。
 * 注意：'widget' 函式在獨立環境執行，不能使用外部變數、hooks 或 import 的函式，
 * 所有要顯示的文字都由 App 事先算好（見 ./widget-data.ts），翻頁邏輯跟 stepView 一樣、要一起改。
 * 按鈕的 onPress 也在小工具裡執行，回傳的值會直接成為新的 props，不需要打開 App。
 */
const BoardWidget = (props: WidgetView, env: WidgetEnvironment<BoardWidgetConfig>) => {
  'widget';
  const family = env.widgetFamily;
  const all = props.pages ?? [];
  // 長按小工具 →「編輯小工具」選了第幾個公布欄（'b3' = 第 3 個）：只看那一個，‹ › 只翻它的未讀
  const pinNo = Number(String(env.configuration?.board ?? 'all').slice(1));
  const pinned = pinNo >= 1 && pinNo <= all.length ? all[pinNo - 1] : null;
  const pages = pinned ? [pinned] : all;
  const count = pages.length;
  const index = pinned ? 0 : props.index >= 0 && props.index < count ? props.index : 0;
  const page = pages[index];
  const white = '#FFFFFF';

  if (!page) {
    return (
      <VStack modifiers={[containerBackground('#9A7FE0', 'widget')]}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(white)]}>打開 App 加入公布欄</Text>
      </VStack>
    );
  }

  const list = page.rows ?? [];
  const n = list.length;
  // 鎖定畫面的小尺寸只放未讀的
  const unread = list.filter((r) => !r.read);
  const first = unread[0];
  const alerting = page.alertText !== '';
  const focusColors = { urgent: '#FF5A6E', important: '#FF9F43', none: '#9A7FE0' };
  const bg = alerting ? (page.alertUrgent ? '#FF3B5C' : '#FF6FA3') : (focusColors[page.topPriority] ?? focusColors.none);
  const alertLine = `${page.alertEmoji} ${page.alertText}`;

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[widgetURL(page.url)]}>
        {alerting ? `📣 ${page.alertBy}：${page.alertText}` : first ? `⚠︎ ${first.title}` : '✓ 公告都看過了'}
      </Text>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL(page.url)]}>
        <Image systemName={alerting || first ? 'megaphone.fill' : 'checkmark'} size={18} />
        {alerting ? (
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>!</Text>
        ) : first ? (
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{page.unreadCount}</Text>
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
          {alerting ? `📣 ${page.alertBy}・${page.groupName}` : first ? `⚠︎ ${page.unreadCount} 則未讀・${page.groupName}` : page.groupName}
        </Text>
        {alerting ? (
          <Text modifiers={[font({ size: 15, weight: 'heavy' }), lineLimit(2)]}>{alertLine}</Text>
        ) : first ? (
          unread.slice(0, 2).map((r, i) => (
            <Text key={i} modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(1)]}>
              {`• ${r.title}`}
            </Text>
          ))
        ) : (
          <Text modifiers={[font({ size: 15, weight: 'heavy' })]}>✓ 公告都看過了</Text>
        )}
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  const medium = family === 'systemMedium';
  const xl = family === 'systemExtraLarge';
  const large = !small && !medium;
  // 一頁放幾則未讀：通報中要讓出位置
  const size = small ? (alerting ? 1 : 3) : medium ? (alerting ? 1 : 3) : alerting ? (xl ? 6 : 5) : xl ? 9 : 7;
  const rawOffset = pinned ? (props.pinGid === pinned.gid ? (props.pinOffset ?? 0) : 0) : (props.offset ?? 0);
  const offset = Math.max(0, Math.min(rawOffset, n - 1));
  const start = Math.floor(offset / size) * size;
  const rows = list.slice(start, start + size);
  const chunks = Math.ceil(n / size);
  const showArrows = count > 1 || n > size;
  const rowSize = small ? 13 : xl ? 20 : 15;

  /**
   * 按 ‹ ›：先翻這個公布欄的下一批未讀，翻完換公布欄；記下切換時間，比它舊的通報就不會再把畫面搶走。
   * 固定看某個公布欄的小工具另外記翻到哪（pinGid / pinOffset），不動到「全部」小工具停的位置。
   */
  const go = (step: number) => {
    let to = index;
    let off = 0;
    if (step > 0 && start + size < n) off = start + size;
    else if (step < 0 && start > 0) off = start - size;
    else if (count < 2) off = step > 0 ? 0 : Math.floor((n - 1) / size) * size;
    else {
      to = (index + step + count) % count;
      const m = (pages[to].rows ?? []).length;
      off = step > 0 || m === 0 ? 0 : Math.floor((m - 1) / size) * size;
    }
    return pinned ? { pinGid: page.gid, pinOffset: off } : { index: to, offset: off, pickedAt: Date.now() };
  };
  const pick = (i: number) => ({ index: i, offset: 0, pickedAt: Date.now() });
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

  const sub = [
    page.unreadCount > 0 ? `${page.unreadCount} 則未讀` : n > 0 ? '都看過了' : '',
    chunks > 1 ? `${Math.floor(start / size) + 1}/${chunks}` : '',
    !small && count > 1 ? `公布欄 ${index + 1}/${count}` : '',
  ]
    .filter((t) => t !== '')
    .join('・');

  return (
    <VStack
      alignment="leading"
      spacing={small ? 4 : 6}
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }),
        containerBackground(bg, 'widget'),
        widgetURL(page.url),
      ]}>
      {/* 頂部：公布欄名稱、未讀數、翻頁、通報 */}
      <HStack spacing={6}>
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: small ? 12 : 14, weight: 'bold' }), foregroundStyle(white), lineLimit(1)]}>
            {page.groupName}
          </Text>
          {sub !== '' ? (
            <Text modifiers={[font({ size: 11 }), foregroundStyle(white), opacity(0.75), lineLimit(1)]}>{sub}</Text>
          ) : null}
        </VStack>
        <Spacer />
        {showArrows ? arrow(-1, 'prev') : null}
        {showArrows ? arrow(1, 'next') : null}
        {small ? null : (
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
          modifiers={[
            frame({ maxWidth: 10000, alignment: 'leading' }),
            padding({ all: small ? 6 : 10 }),
            background('#FFFFFF2E', shapes.roundedRectangle({ cornerRadius: small ? 12 : 16 })),
          ]}>
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
              font({ size: small ? 15 : xl ? 30 : large ? 22 : 18, weight: 'black' }),
              foregroundStyle(white),
              minimumScaleFactor(0.5),
              lineLimit(2),
            ]}>
            {alertLine}
          </Text>
        </VStack>
      ) : null}

      {/* 公告：未讀的在上、已讀的在下（淡一點） */}
      {n === 0 ? (
        <VStack alignment="leading" spacing={2}>
          <Spacer minLength={0} />
          <Text
            modifiers={[
              font({ size: small ? 20 : xl ? 40 : 26, weight: 'black' }),
              foregroundStyle(white),
              minimumScaleFactor(0.5),
            ]}>
            ✓ 沒有要看的公告
          </Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={small ? 3 : 6}>
          {rows.map((r, i) => (
            <HStack key={start + i} spacing={6}>
              <Image
                systemName={r.read ? 'checkmark.circle' : r.priority === 'urgent' ? 'exclamationmark.circle.fill' : 'circle.fill'}
                size={r.read || r.priority === 'urgent' ? rowSize : rowSize - 6}
                color={r.read ? '#FFFFFF8C' : r.priority === 'urgent' ? '#FFE0E0' : white}
              />
              <Text
                modifiers={[
                  font({ size: rowSize, weight: r.read ? 'regular' : 'bold' }),
                  foregroundStyle(white),
                  opacity(r.read ? 0.6 : 1),
                  lineLimit(small ? 2 : 1),
                ]}>
                {r.title}
              </Text>
              <Spacer minLength={4} />
              {!small && r.when !== '' ? (
                <Text modifiers={[font({ size: rowSize - 2 }), foregroundStyle(white), opacity(0.8), lineLimit(1)]}>
                  {r.when}
                </Text>
              ) : null}
            </HStack>
          ))}
        </VStack>
      )}

      <Spacer minLength={0} />

      {/* 大尺寸：每個公布欄一個分頁，有通報 / 未讀的會標出來 */}
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
                {p.alertText ? `📣 ${p.groupName}` : p.unreadCount > 0 ? `${p.groupName}・${p.unreadCount}` : p.groupName}
              </Text>
            </Button>
          ))}
        </HStack>
      ) : null}
    </VStack>
  );
};

export default createWidget<WidgetView, BoardWidgetConfig>('BoardWidget', BoardWidget);
