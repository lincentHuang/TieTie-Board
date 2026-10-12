import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** 圖片最長邊（像素）。壓縮後約 60–150KB，直接存進 Firestore，不需要 Firebase 付費方案 */
const MAX_SIDE = 900;
/** 便利貼附的照片會一次放好幾張，壓小一點，整份文件才塞得進 Firestore 的 1MB */
const PHOTO_SIDE = 720;
/** 一張便利貼所有照片加起來的上限（data URL 字數 ≈ 位元組），留空間給文字等其他欄位 */
const PHOTOS_BUDGET = 850_000;

export interface PickedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * 網頁：expo-image-manipulator 會先把原尺寸照片整張畫進 canvas、再用 JS 逐點縮小，還會多開幾張原尺寸 canvas。
 * 手機照片動輒 1200 萬～4800 萬像素，iPhone Safari 的 canvas 有大小與總記憶體上限，超過就讀不了（傳不上去）。
 * 這裡改成讓瀏覽器解碼後直接畫到目標大小的小 canvas，又快又省記憶體。
 */
async function compressWeb(asset: ImagePicker.ImagePickerAsset, maxSide: number): Promise<PickedImage> {
  const img = new Image();
  img.decoding = 'async';
  img.src = asset.uri;
  try {
    await img.decode();
  } catch {
    // 多半是 HEIC：iPhone Safari 讀得了，其他瀏覽器讀不了
    throw new Error('這張照片的格式瀏覽器讀不了，請換一張，或先轉成 JPG 再上傳');
  }
  const srcW = img.naturalWidth || asset.width;
  const srcH = img.naturalHeight || asset.height;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器記憶體不夠，請關掉其他分頁再試一次');
  ctx.fillStyle = '#FFFFFF'; // 透明的 PNG 轉 JPEG 不要變黑底
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  // 手機 Safari 的 canvas 記憶體要等回收才釋放，先手動縮成 0 讓它馬上還回去
  canvas.width = 0;
  canvas.height = 0;
  if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
  return { dataUrl, width, height };
}

async function compress(asset: ImagePicker.ImagePickerAsset, maxSide: number): Promise<PickedImage> {
  if (Platform.OS === 'web') return compressWeb(asset, maxSide);
  const scale = Math.min(1, maxSide / Math.max(asset.width, asset.height));
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (scale < 1) ctx.resize({ width: Math.round(asset.width * scale) });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

  return {
    dataUrl: `data:image/jpeg;base64,${saved.base64}`,
    width: saved.width,
    height: saved.height,
  };
}

export async function pickImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  return compress(result.assets[0], MAX_SIDE);
}

/** 一次挑好幾張（最多 limit 張），給便利貼附照片用；取消時回傳空陣列 */
export async function pickPhotos(limit: number): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
  });
  if (result.canceled) return [];
  // 一張一張壓，不要同時解碼好幾張大照片把手機記憶體撐爆
  const picked: string[] = [];
  for (const a of result.assets.slice(0, limit)) picked.push((await compress(a, PHOTO_SIDE)).dataUrl);
  return picked;
}

export const photosTooBig = (photos: string[]) => photos.reduce((n, p) => n + p.length, 0) > PHOTOS_BUDGET;
