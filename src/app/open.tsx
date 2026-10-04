import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * 會被 Android App 接走的連結 /open?join=邀請碼（只有 /open 開頭的網址會，LINE 登入回來的網址不會被搶走）。
 * 手機沒裝 App、用瀏覽器打開時，轉回首頁照一般的邀請連結處理；App 裡由 +native-intent.ts 直接轉，不會到這裡
 */
export default function Open() {
  const { join } = useLocalSearchParams<{ join?: string }>();
  return <Redirect href={join ? { pathname: '/', params: { join } } : '/'} />;
}
