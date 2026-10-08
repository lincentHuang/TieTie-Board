import type { FirestoreSettings } from 'firebase/firestore';

/** 手機 App 版：沒有 IndexedDB，照預設存在記憶體 */
export const firestoreSettings: FirestoreSettings = {};
