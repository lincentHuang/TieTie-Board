import type { InstallEnv } from './install-env';

// 手機 App 版：本來就裝好了，不用教安裝

export const APK_URL = '';

export const installEnv = (): InstallEnv | null => null;

export const canPromptInstall = () => false;

export const onInstallPromptChange = (_cb: () => void) => () => {};

export const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => 'unavailable';

export const downloadApk = () => {};

export const openInBrowser = () => {};
