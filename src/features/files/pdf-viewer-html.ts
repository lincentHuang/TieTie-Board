/**
 * PDF 檢視器網頁：網頁版放在 iframe、手機 App 放在 WebView，兩邊同一套，畫面一樣。
 * 用 PDF.js 把每一頁畫成圖（不靠瀏覽器內建的 PDF 檢視，LINE 內建瀏覽器、Android 都沒有）。
 * PDF.js 從 CDN 載入，固定版本；中文字型要的 cMaps 也從同一個地方抓。
 *
 * 跟外面溝通：
 *   檢視器 → 外面：{ type: 'ready' }、{ type: 'loaded', pages }、{ type: 'error', reason }
 *   外面 → 檢視器：網頁版 postMessage({ type: 'pdf', data: Uint8Array })；
 *                 手機版 window.__pdfPart(base64 片段) 多次，最後 window.__pdfDone()
 */
export const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/';

export type PdfErrorReason = 'password' | 'invalid' | 'network' | 'unknown';

export type ViewerMessage =
  | { type: 'ready' }
  | { type: 'loaded'; pages: number }
  | { type: 'error'; reason: PdfErrorReason };

/** 畫面要知道的：開好了幾頁，或打不開的原因 */
export type PdfStatus = Exclude<ViewerMessage, { type: 'ready' }>;

const REASONS: PdfErrorReason[] = ['password', 'invalid', 'network', 'unknown'];

/** 檢視器傳出來的訊息：外面收到的都當不可信的資料，格式不對就丟掉 */
export function parseViewerMessage(raw: unknown): ViewerMessage | null {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  if (data.type === 'ready') return { type: 'ready' };
  if (data.type === 'loaded' && 'pages' in data && typeof data.pages === 'number') return { type: 'loaded', pages: data.pages };
  if (data.type === 'error') {
    const reason = 'reason' in data ? REASONS.find((r) => r === data.reason) : undefined;
    return { type: 'error', reason: reason ?? 'unknown' };
  }
  return null;
}

/* 下面是檢視器網頁本身。裡面的 JS 不要用反引號和 ${}，會跟這個 TS 字串打架 */
export const PDF_VIEWER_HTML = `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; background: #ECE6F6; }
  /* 兩指縮放交給下面的程式，瀏覽器只負責上下左右捲動 */
  html { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; }
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", sans-serif; -webkit-user-select: none; user-select: none; }
  #pages { box-sizing: border-box; width: max-content; min-width: 100%; padding: 12px 12px 96px; }
  .page { margin: 0 auto 12px; background: #fff; border-radius: 4px; overflow: hidden;
          box-shadow: 0 2px 10px rgba(75, 63, 107, 0.18); }
  .page canvas { display: block; width: 100%; height: 100%; }
  #hud { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); display: none; align-items: center;
         gap: 4px; padding: 5px; border-radius: 26px; background: rgba(255, 255, 255, 0.94);
         box-shadow: 0 4px 16px rgba(75, 63, 107, 0.22); color: #4B3F6B; white-space: nowrap; }
  #count { padding: 0 10px 0 12px; font-size: 14px; min-width: 52px; text-align: center; }
  #hud button { border: 0; margin: 0; background: #F4EEFF; color: #4B3F6B; font: inherit; font-size: 20px;
                width: 40px; height: 40px; border-radius: 20px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  #hud button#zoom { width: auto; min-width: 58px; padding: 0 8px; font-size: 14px; }
</style>
</head>
<body>
<div id="pages"></div>
<div id="hud">
  <span id="count"></span>
  <button id="out" aria-label="縮小">－</button>
  <button id="zoom" aria-label="恢復原本大小">100%</button>
  <button id="in" aria-label="放大">＋</button>
</div>
<script>
(function () {
  var BASE = '${PDFJS_BASE}';
  var MAX_ZOOM = 5;
  /** 一張畫布最多幾個像素（手機記憶體有限，iPhone 超過會整張變白） */
  var MAX_PIXELS = 12000000;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var pagesEl = document.getElementById('pages');
  var hud = document.getElementById('hud');
  var countEl = document.getElementById('count');
  var zoomEl = document.getElementById('zoom');
  var doc = null, opening = false, pages = [], zoom = 1, fitW = 0, pinch = null, redrawTimer = 0;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else parent.postMessage(msg, '*');
  }

  var pdfjs = import(BASE + 'legacy/build/pdf.min.mjs');
  pdfjs.catch(function () {});

  async function open(data) {
    if (opening) return;
    opening = true;
    var lib;
    try {
      lib = await pdfjs;
    } catch (e) {
      post({ type: 'error', reason: 'network' });
      return;
    }
    try {
      lib.GlobalWorkerOptions.workerSrc = BASE + 'legacy/build/pdf.worker.min.mjs';
      doc = await lib.getDocument({
        data: data,
        cMapUrl: BASE + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: BASE + 'standard_fonts/',
        wasmUrl: BASE + 'wasm/',
        iccUrl: BASE + 'iccs/',
        isEvalSupported: false
      }).promise;
      // 先知道每一頁的長寬比，整份文件的高度一開始就對，捲動不會跳
      var ratios = await Promise.all(Array.from({ length: doc.numPages }, function (_, i) {
        return doc.getPage(i + 1).then(function (page) {
          var v = page.getViewport({ scale: 1 });
          return v.height / v.width;
        });
      }));
      pages = ratios.map(function (ratio, i) {
        var el = document.createElement('div');
        el.className = 'page';
        el.setAttribute('data-index', String(i));
        pagesEl.appendChild(el);
        return { i: i, el: el, ratio: ratio, near: false, drawn: 0, task: null };
      });
    } catch (e) {
      var name = e && e.name;
      post({ type: 'error', reason: name === 'PasswordException' ? 'password' : name === 'InvalidPDFException' ? 'invalid' : 'unknown' });
      return;
    }
    measure();
    layout();
    pages.forEach(function (p) { observer.observe(p.el); });
    hud.style.display = 'flex';
    updateCount();
    post({ type: 'loaded', pages: pages.length });
  }

  function measure() {
    fitW = Math.max(120, Math.min(window.innerWidth - 24, 900));
  }

  function layout() {
    var w = Math.round(fitW * zoom);
    pages.forEach(function (p) {
      p.el.style.width = w + 'px';
      p.el.style.height = Math.round(w * p.ratio) + 'px';
    });
    zoomEl.textContent = Math.round(zoom * 100) + '%';
  }

  /** 快看到的頁面才畫，離開很遠就把畫布丟掉，頁數很多也不會吃光記憶體 */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var p = pages[Number(en.target.getAttribute('data-index'))];
      p.near = en.isIntersecting;
      if (p.near) draw(p);
      else release(p);
    });
  }, { rootMargin: '800px 400px' });

  function draw(p) {
    if (!p.near || pinch || p.drawn === zoom || p.want === zoom) return;
    var target = zoom;
    p.want = target;
    if (p.task) p.task.cancel();
    doc.getPage(p.i + 1).then(function (page) {
      if (!p.near || p.want !== target) return;
      var base = page.getViewport({ scale: 1 });
      var scale = (fitW * target / base.width) * dpr;
      var px = base.width * base.height * scale * scale;
      if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px);
      var vp = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      var task = page.render({ canvas: canvas, viewport: vp });
      p.task = task;
      return task.promise.then(function () {
        if (p.task === task) p.task = null;
        if (!p.near || p.want !== target) return;
        // 畫好才換上去，放大時不會先閃一下白
        p.el.replaceChildren(canvas);
        p.drawn = target;
      });
    }).catch(function (e) {
      if (p.want === target) p.want = 0;
      if (!e || e.name !== 'RenderingCancelledException') console.warn(e);
    });
  }

  function release(p) {
    if (p.task) { p.task.cancel(); p.task = null; }
    p.want = 0;
    if (!p.drawn) return;
    var old = p.el.firstChild;
    if (old) { old.width = 0; old.height = 0; }
    p.el.replaceChildren();
    p.drawn = 0;
  }

  function redrawSoon() {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(function () { pages.forEach(draw); }, 160);
  }

  /** 以 (fx, fy)（畫面上的位置）為中心縮放：手指底下那一點留在手指底下 */
  function setZoom(z, fx, fy) {
    z = Math.min(MAX_ZOOM, Math.max(1, z));
    if (!pages.length || Math.abs(z - zoom) < 0.001) return;
    var r = z / zoom;
    var box = pagesEl.getBoundingClientRect();
    var first = pages[0].el.getBoundingClientRect();
    var ox = fx - first.left, oy = fy - box.top;
    zoom = z;
    layout();
    var box2 = pagesEl.getBoundingClientRect();
    var first2 = pages[0].el.getBoundingClientRect();
    window.scrollBy(first2.left + ox * r - fx, box2.top + oy * r - fy);
  }

  function zoomAt(z, fx, fy) {
    setZoom(z, fx, fy);
    redrawSoon();
  }

  var center = function () { return [window.innerWidth / 2, window.innerHeight / 2]; };
  document.getElementById('in').onclick = function () { var c = center(); zoomAt(zoom * 1.5, c[0], c[1]); };
  document.getElementById('out').onclick = function () { var c = center(); zoomAt(zoom / 1.5, c[0], c[1]); };
  zoomEl.onclick = function () { var c = center(); zoomAt(1, c[0], c[1]); };

  /* 手指：兩指縮放、點兩下放大／縮回 */
  var tap = null, lastTap = null, lastTouchAt = 0, frame = 0;
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

  document.addEventListener('touchstart', function (e) {
    lastTouchAt = Date.now();
    if (e.touches.length === 2 && pages.length) {
      tap = null;
      pinch = { d: dist(e.touches) || 1, z: zoom };
      e.preventDefault();
      return;
    }
    var t = e.touches[0];
    tap = e.touches.length === 1 && !hud.contains(e.target) ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (tap && Math.hypot(e.touches[0].clientX - tap.x, e.touches[0].clientY - tap.y) > 10) tap = null;
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    var t = e.touches, d = dist(t);
    var fx = (t[0].clientX + t[1].clientX) / 2, fy = (t[0].clientY + t[1].clientY) / 2;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(function () { if (pinch) setZoom(pinch.z * d / pinch.d, fx, fy); });
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    lastTouchAt = Date.now();
    if (pinch && e.touches.length < 2) {
      pinch = null;
      redrawSoon();
    }
    if (!tap || e.touches.length || Date.now() - tap.at > 300) { tap = null; return; }
    var now = Date.now();
    if (lastTap && now - lastTap.at < 350 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 40) {
      e.preventDefault();
      zoomAt(zoom > 1.05 ? 1 : 2.5, tap.x, tap.y);
      lastTap = null;
    } else {
      lastTap = { x: tap.x, y: tap.y, at: now };
    }
    tap = null;
  }, { passive: false });

  /* 滑鼠：點兩下放大／縮回；觸控板兩指縮放（瀏覽器會變成按著 Ctrl 的滾輪） */
  document.addEventListener('dblclick', function (e) {
    if (Date.now() - lastTouchAt < 1000 || hud.contains(e.target)) return;
    zoomAt(zoom > 1.05 ? 1 : 2.5, e.clientX, e.clientY);
  });
  document.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY / 300), e.clientX, e.clientY);
  }, { passive: false });

  // 轉向、視窗大小改變（網頁版的彈出視窗剛打開時也會：第一個畫面還沒有大小）
  window.addEventListener('resize', function () {
    if (!pages.length) return;
    var old = fitW;
    measure();
    if (fitW !== old) {
      layout();
      pages.forEach(function (p) { p.drawn = 0; p.want = 0; });
      redrawSoon();
    }
    updateCount();
  });

  /* 目前在第幾頁：畫面上方三分之一的位置落在哪一頁 */
  var countFrame = 0;
  function updateCount() {
    if (!pages.length) return;
    var line = window.scrollY + window.innerHeight * 0.35;
    var lo = 0, hi = pages.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      var el = pages[mid].el;
      if (el.offsetTop + el.offsetHeight > line) hi = mid;
      else lo = mid + 1;
    }
    countEl.textContent = (lo + 1) + ' / ' + pages.length;
  }
  window.addEventListener('scroll', function () {
    if (countFrame) return;
    countFrame = requestAnimationFrame(function () { countFrame = 0; updateCount(); });
  }, { passive: true });

  /* 收檔案 */
  var parts = [];
  window.__pdfPart = function (s) { parts.push(s); };
  window.__pdfDone = function () {
    var bin = atob(parts.join(''));
    parts = [];
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    open(bytes);
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== parent || !d || d.type !== 'pdf' || !(d.data instanceof Uint8Array)) return;
    open(d.data);
  });
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
