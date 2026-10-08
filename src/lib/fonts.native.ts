import { Huninn_400Regular, useFonts } from '@expo-google-fonts/huninn';

/** 手機 App 版：粉圓體包在 App 裡，載入很快，等它好了再顯示（失敗也照常顯示，會退回系統字型） */
export const FONT_DISPLAY = 'Huninn_400Regular';

export function useAppFonts() {
  const [loaded, error] = useFonts({ Huninn_400Regular });
  return loaded || Boolean(error);
}
