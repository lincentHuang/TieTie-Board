import type { AlertLevel } from '@/lib/types';

/** 常用的快速通報，一按就送出 */
export const ALERT_PRESETS: { emoji: string; text: string; level: AlertLevel }[] = [
  { emoji: '🍚', text: '開飯囉！', level: 'normal' },
  { emoji: '🏠', text: '我到家了', level: 'normal' },
  { emoji: '🚗', text: '出發了，等等見', level: 'normal' },
  { emoji: '📞', text: '方便時回個電話', level: 'normal' },
  { emoji: '☔️', text: '快下雨了，記得帶傘', level: 'normal' },
  { emoji: '🚨', text: '緊急！請馬上看手機', level: 'urgent' },
];

/** 自己打字通報時可以挑的表情 */
export const ALERT_EMOJIS = ['📣', '🙋', '⏰', '🛒', '💊', '🐶', '❤️', '⚠️'];
