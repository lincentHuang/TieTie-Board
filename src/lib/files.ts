import type { DocumentPickerAsset } from 'expo-document-picker';

import type { Attachment } from './types';

// 網頁版：挑檔用瀏覽器給的 File，下載過的檔案先放在記憶體（重新整理就清掉）

export async function readPicked(asset: DocumentPickerAsset) {
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  // 挑檔時順手建的暫時網址，讀完就用不到了
  URL.revokeObjectURL(asset.uri);
  return new Uint8Array(buffer);
}

/** 記憶體裡最多留多少（位元組），超過就丟掉最久沒看的 */
const CACHE_BUDGET = 40 * 1024 * 1024;
const cache = new Map<string, Uint8Array<ArrayBuffer>>();

export async function readCached(file: Attachment) {
  const bytes = cache.get(file.id);
  if (!bytes) return null;
  // 重新放到最後面 = 最近看過
  cache.delete(file.id);
  cache.set(file.id, bytes);
  return bytes;
}

export function saveToCache(file: Attachment, bytes: Uint8Array<ArrayBuffer>) {
  cache.delete(file.id);
  cache.set(file.id, bytes);
  let total = 0;
  for (const b of cache.values()) total += b.length;
  for (const [id, b] of cache) {
    if (total <= CACHE_BUDGET || id === file.id) break;
    cache.delete(id);
    total -= b.length;
  }
}

/** 存到裝置上（瀏覽器的下載），再用 Word 等其他 App 打開 */
export async function openExternally(file: Attachment, bytes: Uint8Array<ArrayBuffer>) {
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 下載開始之後才放掉，太早放掉有些瀏覽器會下載失敗
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 按下去會做什麼（按鈕文字用） */
export const OPEN_EXTERNALLY_LABEL = '下載';
