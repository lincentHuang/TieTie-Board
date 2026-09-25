import type { FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, initializeAuth } from 'firebase/auth';

// 網頁版：登入狀態存在瀏覽器 localStorage
export const createAuth = (app: FirebaseApp) =>
  initializeAuth(app, { persistence: browserLocalPersistence });
