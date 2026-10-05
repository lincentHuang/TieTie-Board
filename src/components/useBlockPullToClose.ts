import { useEffect, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

/**
 * 網頁：手指在白板、面板頂端拖曳時，不讓瀏覽器自己的拖曳手勢接手。
 * iPhone 的 LINE 內建瀏覽器往下拖會把整個頁面關掉（LIFF 則是縮小），
 * 手勢套件設的 CSS touch-action 擋不住它，只有 touchmove 呼叫 preventDefault 擋得住。
 * 不擋 touchstart：擋了按鈕就收不到 click，會按不下去。
 * 會捲動的區塊（例如排隊狀態列的分類標籤）照常可以滑。
 * active = false 時不擋（例如面板還沒打開）
 */
export function useBlockPullToClose(ref: RefObject<View | null>, active = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    // 每次手指放下時決定一次就好，不用每一格移動都重新找
    let free = false;
    const onTouchStart = (e: TouchEvent) => {
      free = e.touches.length === 1 && insideScroller(e.target, el);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!free && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [ref, active]);
}

/** 手指是不是落在真的能捲動的區塊上 */
function insideScroller(target: EventTarget | null, root: HTMLElement) {
  for (let node = target instanceof Element ? target : null; node && node !== root; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node);
    if (/auto|scroll/.test(overflowX) && node.scrollWidth > node.clientWidth) return true;
    if (/auto|scroll/.test(overflowY) && node.scrollHeight > node.clientHeight) return true;
  }
  return false;
}
