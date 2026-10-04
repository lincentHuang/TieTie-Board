import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

import { readPicked } from './files';
import { MAX_FILE_BYTES, type Attachment } from './types';

/** 可以附的檔案：PDF、Word、Excel、PowerPoint、純文字 */
const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
/** 網頁版再加上副檔名：有些瀏覽器認不出 Office 檔的類型，只看類型會選不到 */
const WEB_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];

/** 檔名太長就從中間截掉，保留副檔名 */
const MAX_NAME = 80;
const trimName = (name: string) => {
  if (name.length <= MAX_NAME) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : '';
  return name.slice(0, MAX_NAME - ext.length - 1) + '…' + ext;
};

export interface PickedFile {
  file: Attachment;
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * 挑檔案（最多 limit 個）。太大的不讀進來，檔名放在 tooBig 讓畫面提醒；取消時兩個都是空的。
 * 網頁版要在按鈕的 onPress 裡直接呼叫，瀏覽器才會打開選檔視窗
 */
export async function pickDocuments(limit: number) {
  const result = await DocumentPicker.getDocumentAsync({
    type: Platform.OS === 'web' ? [...DOCUMENT_MIMES, ...WEB_EXTENSIONS] : DOCUMENT_MIMES,
    multiple: limit > 1,
    copyToCacheDirectory: true,
    // 網頁版直接給 File，不要先轉成 base64（大檔案很慢）
    base64: false,
  });
  const accepted: PickedFile[] = [];
  const tooBig: string[] = [];
  if (result.canceled) return { accepted, tooBig };

  for (const asset of result.assets.slice(0, limit)) {
    if ((asset.size ?? 0) > MAX_FILE_BYTES) {
      tooBig.push(asset.name);
      continue;
    }
    const bytes = await readPicked(asset);
    // 有些裝置挑檔時拿不到大小，讀進來之後再檢查一次
    if (bytes.length > MAX_FILE_BYTES) {
      tooBig.push(asset.name);
      continue;
    }
    accepted.push({
      file: { id: randomUUID(), name: trimName(asset.name), size: bytes.length, mime: asset.mimeType || 'application/octet-stream' },
      bytes,
    });
  }
  return { accepted, tooBig };
}
