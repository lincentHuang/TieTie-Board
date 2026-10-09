/** 跟著配色主題變的顏色；警示、狀態、LINE 綠這些有意義的顏色不換 */
export interface ThemeColors {
  bg: string;
  canvas: string;
  dot: string;
  ink: string;
  sub: string;
  line: string;
  primary: string;
}

/** 背景只換這三個：外框底色、白板底色、方格點 */
export type BackgroundColors = Pick<ThemeColors, 'bg' | 'canvas' | 'dot'>;

export interface ThemePreset {
  id: string;
  label: string;
  colors: ThemeColors;
}

export interface BackgroundPreset {
  id: string;
  label: string;
  colors: BackgroundColors;
}

/** 色碼一律六碼，因為程式裡會直接在後面接透明度（C.primary + '22'） */
export const THEMES: ThemePreset[] = [
  {
    id: 'berry',
    label: '草莓牛奶',
    colors: {
      bg: '#FBF7FF',
      canvas: '#F4EEFF',
      dot: '#DCD2F5',
      ink: '#4B3F6B',
      sub: '#8C84A8',
      line: '#E9E2F7',
      primary: '#FF6FA3',
    },
  },
  {
    id: 'mint',
    label: '薄荷蘇打',
    colors: {
      bg: '#F5FCF9',
      canvas: '#E6F6EF',
      dot: '#C2E6D7',
      ink: '#2F5249',
      sub: '#7A9990',
      line: '#DCEFE7',
      primary: '#1FAF85',
    },
  },
  {
    id: 'sky',
    label: '晴空藍',
    colors: {
      bg: '#F6FAFF',
      canvas: '#E9F1FF',
      dot: '#CADBF6',
      ink: '#34466B',
      sub: '#8193B3',
      line: '#E0E9F8',
      primary: '#4A8BEF',
    },
  },
  {
    id: 'butter',
    label: '奶油布丁',
    colors: {
      bg: '#FFFCF4',
      canvas: '#FFF4DA',
      dot: '#EFDCAE',
      ink: '#5A4632',
      sub: '#A08D73',
      line: '#F4E9CE',
      primary: '#EE9324',
    },
  },
  {
    id: 'lavender',
    label: '薰衣草',
    colors: {
      bg: '#F9F7FF',
      canvas: '#EDE8FF',
      dot: '#D3CAF4',
      ink: '#43386B',
      sub: '#8A82AC',
      line: '#E5DFF8',
      primary: '#8B6CF0',
    },
  },
  {
    id: 'peach',
    label: '蜜桃汽水',
    colors: {
      bg: '#FFF8F5',
      canvas: '#FFEBE3',
      dot: '#F4CBBD',
      ink: '#5E3F3A',
      sub: '#A88A84',
      line: '#F6E3DC',
      primary: '#FF7A59',
    },
  },
];

/** 'theme' = 跟著配色主題 */
export const BACKGROUNDS: BackgroundPreset[] = [
  {
    id: 'white',
    label: '純白',
    colors: { bg: '#FFFFFF', canvas: '#F6F6F8', dot: '#DCDCE3' },
  },
  {
    id: 'cream',
    label: '米白',
    colors: { bg: '#FFFBF4', canvas: '#F7F0E3', dot: '#E2D5BE' },
  },
  {
    id: 'pink',
    label: '櫻花',
    colors: { bg: '#FFF7FA', canvas: '#FFE9F1', dot: '#F5C8D8' },
  },
  {
    id: 'matcha',
    label: '抹茶',
    colors: { bg: '#F7FBF3', canvas: '#EAF4DF', dot: '#C8DFB3' },
  },
  {
    id: 'ice',
    label: '冰藍',
    colors: { bg: '#F5FAFD', canvas: '#E3F0F8', dot: '#BEDBEA' },
  },
  {
    id: 'gray',
    label: '霧灰',
    colors: { bg: '#F7F7F8', canvas: '#EBEBEE', dot: '#D1D1D8' },
  },
];

export const DEFAULT_THEME = 'berry';
export const FOLLOW_THEME = 'theme';

export function paletteOf(themeId: string, bgId: string): ThemeColors {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const bg = BACKGROUNDS.find((b) => b.id === bgId);
  return bg ? { ...theme.colors, ...bg.colors } : theme.colors;
}
