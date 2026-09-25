export type Species = 'dog' | 'cat' | 'bunny' | 'bear' | 'hamster';
export type Accessory = 'none' | 'bow' | 'crown' | 'glasses' | 'scarf' | 'flower';
export type Mood = 'happy' | 'idle' | 'worried' | 'excited' | 'sleepy';

export interface PetConfig {
  species: Species;
  color: string;
  accessory: Accessory;
  name: string;
}

export const SPECIES: Record<Species, { label: string; emoji: string; sound: string; defaultName: string }> = {
  dog: { label: '狗狗', emoji: '🐶', sound: '汪', defaultName: '豆豆' },
  cat: { label: '貓咪', emoji: '🐱', sound: '喵', defaultName: '咪咪' },
  bunny: { label: '兔兔', emoji: '🐰', sound: '噗', defaultName: '棉花糖' },
  bear: { label: '熊熊', emoji: '🐻', sound: '呼', defaultName: '布丁' },
  hamster: { label: '倉鼠', emoji: '🐹', sound: '吱', defaultName: '麻糬' },
};

export const FUR_COLORS = [
  { value: '#FFE3B3', label: '奶油' },
  { value: '#E8B27A', label: '焦糖' },
  { value: '#FFFFFF', label: '雪白' },
  { value: '#C9CCD8', label: '灰灰' },
  { value: '#FFC8DA', label: '草莓' },
  { value: '#BFE9DA', label: '薄荷' },
  { value: '#9C7564', label: '可可' },
];

export const ACCESSORIES: { value: Accessory; label: string }[] = [
  { value: 'none', label: '不戴' },
  { value: 'bow', label: '蝴蝶結' },
  { value: 'crown', label: '皇冠' },
  { value: 'glasses', label: '眼鏡' },
  { value: 'scarf', label: '領巾' },
  { value: 'flower', label: '小花' },
];

export const DEFAULT_PET: PetConfig = { species: 'dog', color: '#FFE3B3', accessory: 'scarf', name: '豆豆' };

/** 每確認一則公告 +2、每發一則公告 +1；每 6 點升一級 */
export const XP = { ack: 2, post: 1 };
const XP_PER_LEVEL = 6;

export function levelOf(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return { level, progress: (xp % XP_PER_LEVEL) / XP_PER_LEVEL, toNext: XP_PER_LEVEL - (xp % XP_PER_LEVEL) };
}

export function titleOf(level: number) {
  if (level >= 10) return '傳說級管家';
  if (level >= 7) return '超級管家';
  if (level >= 5) return '公告達人';
  if (level >= 3) return '可靠小幫手';
  return '見習小幫手';
}

/** 把毛色調深，用在耳朵、尾巴等部位 */
export function shade(hex: string, amount = -0.18) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + c * amount)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 0xff);
  const b = f(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
