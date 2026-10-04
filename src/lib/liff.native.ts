import type { LineIdentity } from './line';

// 手機 App 版：LIFF 只能在網頁（LINE 內建瀏覽器）裡用，App 照舊匿名登入、自己取暱稱
export const canLoginWithLine = false;

export const lineIdentity = async (): Promise<LineIdentity | null> => null;

export const loginWithLine = async () => {};

export const forgetLineLogin = () => {};

export const canShareToLine = () => false;

export const shareToLine = async (_text: string) => false;

export const openInExternalBrowser = (_url: string) => false;
