/**
 * LINE 登入（LIFF / LINE MINI App）共用的設定與小工具，各平台都能用。
 * 沒設 EXPO_PUBLIC_LIFF_ID 就照舊：匿名登入、自己取暱稱、輸入邀請碼。
 */
export const LIFF_ID = process.env.EXPO_PUBLIC_LIFF_ID ?? '';

/** LIFF 拿到的 LINE 身分（ID token 交給伺服器驗證，名字頭像拿來顯示） */
export interface LineIdentity {
  idToken: string;
  /** LINE 使用者 ID */
  sub: string;
  name: string | null;
  avatarUrl: string | null;
}

/** 貼到家庭群組的邀請連結：在 LINE 裡點開就用自己的 LINE 名字和頭像加入這個公布欄 */
export const lineInviteLink = (code: string) => (LIFF_ID ? `https://miniapp.line.me/${LIFF_ID}?join=${code}` : null);

const asCode = (v: unknown) => {
  const code = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
};

/**
 * 網址上的邀請碼 ?join=邀請碼。
 * 從 LINE 打開時，LIFF 會先把它包成 ?liff.state=%3Fjoin%3D邀請碼 再轉一次址，兩種都認。
 */
export function joinCodeFrom(params: { join?: unknown; 'liff.state'?: unknown }) {
  const direct = asCode(params.join);
  if (direct) return direct;
  const state = params['liff.state'];
  if (typeof state !== 'string') return null;
  const query = state.slice(state.indexOf('?') + 1);
  return asCode(new URLSearchParams(query).get('join'));
}
