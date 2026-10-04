import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { InstallEnv } from './install-env';
import { canPromptInstall, installEnv, onInstallPromptChange, promptInstall } from './install';

/** 安裝提醒被按掉後，到這個時間（毫秒）之前都不再出現 */
const HINT_KEY = 'installHintUntil';
const DAY = 24 * 60 * 60 * 1000;

/** 提醒條與設定面板裡的安裝說明是分開的元件，按掉或裝好時一起通知 */
const hintListeners = new Set<(until: number) => void>();

/** 收起安裝提醒幾天（設定裡的「裝到手機」一直都在） */
export function hideInstallHint(days: number) {
  const until = Date.now() + days * DAY;
  AsyncStorage.setItem(HINT_KEY, String(until)).catch(() => {});
  hintListeners.forEach((l) => l(until));
}

/** 網頁版：在哪種裝置、瀏覽器能不能直接跳出安裝視窗（手機 App 版 env 是 null） */
export function useInstall() {
  const [env] = useState(installEnv);
  const [canPrompt, setCanPrompt] = useState(canPromptInstall);
  useEffect(() => onInstallPromptChange(() => setCanPrompt(canPromptInstall())), []);

  const prompt = async () => {
    const outcome = await promptInstall();
    setCanPrompt(canPromptInstall());
    if (outcome === 'accepted') hideInstallHint(365);
    return outcome;
  };
  return { env, canPrompt, prompt };
}

/** 安裝提醒：手機網頁版、還沒裝到主畫面、最近沒按「之後再說」才出現 */
export function useInstallHint(env: InstallEnv | null) {
  const wanted = env !== null && env.platform !== 'desktop' && !env.standalone;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!wanted) return;
    const update = (until: number) => setVisible(!(until > Date.now()));
    AsyncStorage.getItem(HINT_KEY)
      .then((until) => update(Number(until)))
      .catch(() => setVisible(true));
    hintListeners.add(update);
    return () => {
      hintListeners.delete(update);
    };
  }, [wanted]);
  return wanted && visible;
}
