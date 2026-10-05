import type { AlertPreset } from '@/lib/types';

/** 還沒自己設定過時的快速通報按鈕，一按就送出 */
export const DEFAULT_ALERT_PRESETS: AlertPreset[] = [
  { id: 'meal', emoji: '🍚', text: '開飯囉！', level: 'normal' },
  { id: 'home', emoji: '🏠', text: '我到家了', level: 'normal' },
  { id: 'leave', emoji: '🚗', text: '出發了，等等見', level: 'normal' },
  { id: 'call', emoji: '📞', text: '方便時回個電話', level: 'normal' },
  { id: 'rain', emoji: '☔️', text: '快下雨了，記得帶傘', level: 'normal' },
  { id: 'sos', emoji: '🚨', text: '緊急！請馬上看手機', level: 'urgent' },
];

/** 自己打字通報、設定按鈕時可以挑的表情 */
export const ALERT_EMOJIS = ['📣', '🙋', '⏰', '🛒', '💊', '🐶', '❤️', '⚠️', '🍚', '🏠', '🚗', '📞', '☔️', '🚨', '🎒', '🛁'];

/** 新按鈕的 id：只要在自己的按鈕裡不重複就好 */
export const newPresetId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
