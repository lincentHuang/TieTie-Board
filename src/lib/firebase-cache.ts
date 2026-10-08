import { persistentLocalCache, persistentMultipleTabManager, type FirestoreSettings } from 'firebase/firestore';

/**
 * 網頁版：資料存在瀏覽器（IndexedDB），下次打開先顯示上次的內容、再在背景更新，在 LINE 裡打開不用等網路。
 * 瀏覽器不支援（例如無痕模式）時 Firestore 會自己退回只存在記憶體
 */
export const firestoreSettings: FirestoreSettings = {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
};
