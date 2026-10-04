import { File, Paths } from 'expo-file-system';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { parseViewerMessage, PDF_VIEWER_HTML, PDFJS_BASE, type PdfStatus } from './pdf-viewer-html';

/** 一次塞進 WebView 的 base64 長度：太長的字串有些 Android 手機會卡住 */
const PART = 512 * 1024;

/**
 * 手機 App：檢視器放在 WebView 裡。網址設成 PDF.js 所在的 CDN，
 * PDF.js 的背景執行緒（worker）才能直接從同一個地方載入
 */
export function PdfFrame({ bytes, onStatus }: { bytes: Uint8Array<ArrayBuffer>; onStatus: (status: PdfStatus) => void }) {
  const view = useRef<WebView>(null);
  const sent = useRef(false);

  const send = async () => {
    if (sent.current) return;
    sent.current = true;
    try {
      // 用系統把檔案轉成 base64，比用 JS 一個位元組一個位元組轉快很多
      const tmp = new File(Paths.cache, 'pdf-viewer.pdf');
      tmp.create({ overwrite: true });
      tmp.write(bytes);
      const b64 = await tmp.base64();
      for (let i = 0; i < b64.length; i += PART) {
        view.current?.injectJavaScript(`window.__pdfPart(${JSON.stringify(b64.slice(i, i + PART))});true;`);
      }
      view.current?.injectJavaScript('window.__pdfDone();true;');
    } catch (e) {
      console.warn('把 PDF 交給檢視器失敗', e);
      onStatus({ type: 'error', reason: 'unknown' });
    }
  };

  return (
    <WebView
      ref={view}
      source={{ html: PDF_VIEWER_HTML, baseUrl: PDFJS_BASE }}
      originWhitelist={['*']}
      onMessage={(e) => {
        const msg = parseViewerMessage(e.nativeEvent.data);
        if (!msg) return;
        if (msg.type === 'ready') send();
        else onStatus(msg);
      }}
      onError={() => onStatus({ type: 'error', reason: 'network' })}
      // 縮放交給檢視器自己處理
      setBuiltInZoomControls={false}
      setSupportMultipleWindows={false}
      bounces={false}
      style={s.view}
    />
  );
}

const s = StyleSheet.create({
  view: { flex: 1, backgroundColor: '#ECE6F6' },
});
