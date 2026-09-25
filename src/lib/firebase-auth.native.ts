import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
// firebase/auth 的型別沒有列出 RN 專用 API，但 Metro 會解析到 RN 版本
// @ts-expect-error getReactNativePersistence 只存在於 React Native 版本
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

// 手機版：登入狀態存在 AsyncStorage，重開 App 不會變成新成員
export const createAuth = (app: FirebaseApp) =>
  initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
