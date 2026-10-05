import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { postApi, SITE_URL } from './api';

/**
 * 手機 App 用 LINE / Google 登入（App 裡沒有 LIFF，也開不了 Firebase 的 Google 彈出視窗）：
 * 用系統瀏覽器打開伺服器的 /api/oauth（它轉到 LINE / Google 的登入頁），登入完帶著 code 回到 tietieboard://oauth，
 * 再請伺服器把 code 換成 ID token（要用 channel secret / client secret，只能在伺服器做）。
 * 用 PKCE：codeVerifier 只有這次發起登入的 App 知道，code 被別的 App 攔到也換不到。
 */
export type OAuthProvider = 'line' | 'google';

export interface OAuthLogin {
  idToken: string;
  /** LINE / Google 的使用者 ID */
  sub: string;
  name: string | null;
  picture: string | null;
}

/** 登入完跳回 App 的網址（+native-intent.ts 會忽略它，不換畫面） */
export const OAUTH_RETURN_URL = 'tietieboard://oauth';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const base64url = (base64: string) => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** 登入並拿到 ID token；使用者關掉瀏覽器或按「取消」回傳 null */
export async function oauthLogin(provider: OAuthProvider): Promise<OAuthLogin | null> {
  const state = hex(Crypto.getRandomBytes(16));
  const codeVerifier = hex(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const query = new URLSearchParams({ provider, state, challenge: base64url(digest) });
  const result = await WebBrowser.openAuthSessionAsync(`${SITE_URL}/api/oauth?${query}`, OAUTH_RETURN_URL);
  if (result.type !== 'success') return null;

  // 不用 expo-linking 的 parse：它會再解碼一次，值裡有 % 就壞了
  const params = new URL(result.url).searchParams;
  if (params.get('state') !== state) throw new Error('登入沒有完成，請再試一次');
  const code = str(params.get('code'));
  if (!code) {
    const error = str(params.get('error')) ?? 'unknown';
    if (error === 'access_denied') return null;
    throw new Error(str(params.get('error_description')) ?? `登入失敗（${error}），請再試一次`);
  }

  const body = await postApi('/api/oauth', { provider, code, codeVerifier }, '登入失敗');
  const idToken = str(body.idToken);
  const sub = str(body.sub);
  if (!idToken || !sub) throw new Error('登入失敗，請稍後再試');
  return { idToken, sub, name: str(body.name), picture: str(body.picture) };
}
