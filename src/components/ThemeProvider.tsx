import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { DEFAULT_THEME, FOLLOW_THEME, paletteOf } from './palettes';
import { applyPalette, C } from './ui';

interface ThemeChoice {
  theme: string;
  background: string;
}

interface ThemeContextValue extends ThemeChoice {
  setTheme: (theme: string) => void;
  setBackground: (background: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const KEYS = ['themeId', 'themeBackground'] as const;

/** 換完配色畫面會整個重新掛載，設定面板會被關掉；記一下讓白板重開時把它打開 */
let reopenSettings = false;
export function takeReopenSettings() {
  const v = reopenSettings;
  reopenSettings = false;
  return v;
}

/** 網頁版捲過頭、鍵盤推上來時露出來的底色也要跟著換 */
function paintPage() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') document.body.style.backgroundColor = C.bg;
}

/**
 * 配色是每個人自己的喜好，記在這台裝置上。
 * 所有樣式都在模組載入時就算好，換配色後用 key 把底下整棵樹重新掛載，元件才會拿到新顏色。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    AsyncStorage.multiGet(KEYS)
      .then(([[, theme], [, background]]) => ({
        theme: theme ?? DEFAULT_THEME,
        background: background ?? FOLLOW_THEME,
      }))
      .catch(() => ({ theme: DEFAULT_THEME, background: FOLLOW_THEME }))
      .then((c) => {
        applyPalette(paletteOf(c.theme, c.background));
        paintPage();
        setChoice(c);
      });
  }, []);

  if (!choice) return null;

  const change = (next: ThemeChoice) => {
    if (next.theme === choice.theme && next.background === choice.background) return;
    applyPalette(paletteOf(next.theme, next.background));
    paintPage();
    reopenSettings = true;
    setChoice(next);
    setVersion((v) => v + 1);
    AsyncStorage.multiSet([
      [KEYS[0], next.theme],
      [KEYS[1], next.background],
    ]).catch((e) => console.warn('配色存檔失敗', e));
  };

  const value: ThemeContextValue = {
    ...choice,
    setTheme: (theme) => change({ ...choice, theme }),
    setBackground: (background) => change({ ...choice, background }),
  };

  return (
    <ThemeContext value={value}>
      <ThemeRoot key={version}>{children}</ThemeRoot>
    </ThemeContext>
  );
}

function ThemeRoot({ children }: { children: ReactNode }) {
  return children;
}

export function useTheme() {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error('useTheme 要在 ThemeProvider 裡面用');
  return ctx;
}
