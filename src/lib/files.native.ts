import type { DocumentPickerAsset } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Attachment } from './types';

// 手機 App：下載過的檔案存在快取資料夾（系統空間不夠時會自己清掉），再看一次不用重新下載

/** 檔名裡不能放的字元換掉 */
const safeName = (name: string) => name.replace(/[/\\:*?"<>|]/g, '_') || 'file';

/** 每個檔案一個資料夾，分享出去時檔名還是原本的 */
const cachedFile = (file: Attachment) => new File(Paths.cache, 'attachments', file.id, safeName(file.name));

export const readPicked = (asset: DocumentPickerAsset) => new File(asset.uri).bytes();

export async function readCached(file: Attachment) {
  try {
    const f = cachedFile(file);
    return f.exists ? await f.bytes() : null;
  } catch (e) {
    console.warn('讀取快取的檔案失敗', e);
    return null;
  }
}

export function saveToCache(file: Attachment, bytes: Uint8Array<ArrayBuffer>) {
  try {
    const f = cachedFile(file);
    f.create({ intermediates: true, overwrite: true });
    f.write(bytes);
  } catch (e) {
    // 存不進快取只是下次要重新下載
    console.warn('檔案存進快取失敗', e);
  }
}

/** 跳出分享選單：用 Word、Pages 等其他 App 打開，或存到「檔案」 */
export async function openExternally(file: Attachment, bytes: Uint8Array<ArrayBuffer>) {
  const f = cachedFile(file);
  if (!f.exists) {
    f.create({ intermediates: true, overwrite: true });
    f.write(bytes);
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('這台裝置沒辦法用其他 App 打開檔案');
  await Sharing.shareAsync(f.uri, { mimeType: file.mime, dialogTitle: file.name });
}

/** 按下去會做什麼（按鈕文字用） */
export const OPEN_EXTERNALLY_LABEL = '用其他 App 開啟';
