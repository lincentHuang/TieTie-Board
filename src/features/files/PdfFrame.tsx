import { useLayoutEffect, useRef } from 'react';

import { parseViewerMessage, PDF_VIEWER_HTML, type PdfStatus } from './pdf-viewer-html';

/**
 * 網頁版：檢視器放在 iframe 裡。
 * sandbox 只開 allow-scripts：iframe 變成獨立的來源，就算 PDF 裡藏了惡意內容也碰不到公布欄的登入資料
 */
export function PdfFrame({ bytes, onStatus }: { bytes: Uint8Array<ArrayBuffer>; onStatus: (status: PdfStatus) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);

  // 在 iframe 的程式開始跑之前就要開始聽，不然會漏掉「準備好了」
  useLayoutEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const target = frame.current?.contentWindow;
      if (!target || e.source !== target) return;
      const msg = parseViewerMessage(e.data);
      if (!msg) return;
      // 傳一份複本過去，快取裡的那份留著下次用
      if (msg.type === 'ready') target.postMessage({ type: 'pdf', data: bytes }, '*');
      else onStatus(msg);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [bytes, onStatus]);

  return (
    <iframe
      ref={frame}
      title="PDF 檢視"
      srcDoc={PDF_VIEWER_HTML}
      sandbox="allow-scripts"
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#ECE6F6' }}
    />
  );
}
