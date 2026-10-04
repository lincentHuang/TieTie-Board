import type { PickedFile } from '@/lib/documents';
import { readCached, saveToCache } from '@/lib/files';
import { deleteFiles, fetchFile, uploadFile } from '@/lib/repo';
import type { Attachment } from '@/lib/types';

/** 還沒存進白板的新檔案（檔案 id → 內容），按下儲存才上傳 */
export type PendingFiles = Record<string, Uint8Array<ArrayBuffer>>;

/** 拿檔案內容：看過的直接用快取，沒有才下載 */
export async function loadFile(gid: string, file: Attachment, onProgress?: (ratio: number) => void) {
  const cached = await readCached(file);
  if (cached) return cached;
  const bytes = await fetchFile(gid, file, onProgress);
  saveToCache(file, bytes);
  return bytes;
}

/** 依序上傳新檔案，onProgress 收到全部加起來的進度（0–1） */
export async function uploadFiles(gid: string, uid: string, uploads: PickedFile[], onProgress: (ratio: number) => void) {
  const total = uploads.reduce((n, u) => n + u.bytes.length, 0) || 1;
  let done = 0;
  for (const u of uploads) {
    await uploadFile(gid, uid, u.file, u.bytes, (r) => onProgress((done + r * u.bytes.length) / total));
    done += u.bytes.length;
    // 自己剛傳的，等一下點開不用再下載
    saveToCache(u.file, u.bytes);
  }
}

/** 項目刪掉、附件拿掉之後清掉檔案內容；失敗只是多佔一點空間，不打擾使用者 */
export function discardFiles(gid: string, files: Attachment[]) {
  deleteFiles(gid, files).catch((e) => console.warn('清除附件內容失敗', e));
}
