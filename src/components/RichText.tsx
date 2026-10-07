import { Linking, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { showError } from '@/components/dialogs';
import { C } from '@/components/ui';
import { parseRichText } from '@/lib/rich-text';

/**
 * 顯示便利貼內容：標題放大、重點字畫螢光筆、連結藍色底線。
 * linkable = false 時連結只是樣子（白板卡片要能拖曳，點不到）；檢視畫面才真的能點
 */
export function RichText({
  text,
  fontSize,
  lineHeight,
  style,
  linkable = false,
  selectable,
}: {
  text: string;
  fontSize: number;
  lineHeight: number;
  style?: StyleProp<TextStyle>;
  linkable?: boolean;
  selectable?: boolean;
}) {
  const lines = parseRichText(text);
  const open = (url: string) => Linking.openURL(url).catch((e: unknown) => showError('打不開連結', e));

  return (
    <Text selectable={selectable} style={[style, { fontSize, lineHeight }]}>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={line.heading ? { fontSize: Math.round(fontSize * 1.3), lineHeight: Math.round(lineHeight * 1.3), color: C.ink } : undefined}>
          {line.spans.map((span, j) =>
            span.url ? (
              <Text
                key={j}
                style={s.link}
                onPress={linkable ? () => open(span.url ?? '') : undefined}
                accessibilityRole={linkable ? 'link' : undefined}>
                {span.text}
              </Text>
            ) : span.bold ? (
              <Text key={j} style={s.mark}>
                {span.text}
              </Text>
            ) : (
              span.text
            ),
          )}
          {i < lines.length - 1 ? '\n' : ''}
        </Text>
      ))}
    </Text>
  );
}

const s = StyleSheet.create({
  // 粉圓體只有一種粗細，重點字用螢光筆的樣子
  mark: { backgroundColor: '#FFE06699', color: '#C2185B' },
  link: { color: '#2F7DE1', textDecorationLine: 'underline' },
});
