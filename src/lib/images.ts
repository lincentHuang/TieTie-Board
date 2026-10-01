import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

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

async function compress(asset: ImagePicker.ImagePickerAsset, maxSide: number): Promise<PickedImage> {
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
  const picked = await Promise.all(result.assets.slice(0, limit).map((a) => compress(a, PHOTO_SIDE)));
  return picked.map((p) => p.dataUrl);
}

export const photosTooBig = (photos: string[]) => photos.reduce((n, p) => n + p.length, 0) > PHOTOS_BUDGET;
