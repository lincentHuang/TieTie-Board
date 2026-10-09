import { Platform } from 'react-native';

/** 補送的 click 通常幾十毫秒內就到；等這麼久還沒來就不擋了，免得吃掉之後正常的點擊 */
const GHOST_MS = 500;

/**
 * 網頁：手指放開之後，手機瀏覽器還會補送一組 mousedown / mouseup / click，打在「那時候」手指底下的東西上。
 * 手勢套件的點擊在手指一放開就觸發，如果這時候打開了面板，補上來的 click 就打在面板的背景上，
 * 面板馬上又被關掉（看起來就像點兩下、點「新增」都沒反應）。
 * 用手勢打開面板之前呼叫：把接下來的那一組補送事件吃掉。
 */
export function swallowGhostClick() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const types = ['mousedown', 'mouseup', 'click'] as const;
  const stop = () => {
    clearTimeout(timer);
    for (const type of types) window.removeEventListener(type, eat, true);
  };
  function eat(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'click') stop();
  }
  // 掛在 window 的捕捉階段：比 React 和畫面上任何元件都先收到
  for (const type of types) window.addEventListener(type, eat, true);
  timer = setTimeout(stop, GHOST_MS);
}
