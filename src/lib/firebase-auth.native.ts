import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
// firebase/auth 的型別沒有列出 RN 專用 API，但 Metro 會解析到 RN 版本
// @ts-expect-error getReactNativePersistence 只存在於 React Native 版本
import { getReactNativePersistence, initializeAuth, type Auth, type User } from 'firebase/auth';

// 手機版：登入狀態存在 AsyncStorage，重開 App 不會變成新成員
export const createAuth = (app: FirebaseApp) =>
  initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// 手機 App 版還沒有 Google 登入（要另外裝原生的 Google 登入套件），照舊匿名登入、自己取暱稱
export const canLoginWithGoogle = () => false;

export type GoogleLink = { linked: User } | { switchAccount: () => Promise<User> };

export const linkGoogle = async (_auth: Auth, _user: User): Promise<GoogleLink | null> => null;
