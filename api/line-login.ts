import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * Vercel Function：POST /api/line-login
 * 用 LINE 的 ID token 換一張 Firebase 登入憑證（custom token）。
 *
 * 1. 向 LINE 驗證 ID token：確定真的是這個 LINE 帳號，不是網頁自己編的
 * 2. 查這個 LINE 帳號對應的成員 uid（Firestore 的 lineAccounts/{LINE 使用者 ID}）
 *    - 第一次：這台裝置原本是匿名成員就沿用它的 uid（公布欄、便利貼都留著），不然開一個新的 line:{ID}
 *    - 之後：不管在哪台裝置，都換回同一個 uid
 * 3. 發 custom token（帶著 lineSub），網頁用 signInWithCustomToken 登入
 *
 * 環境變數（Vercel 專案設定；是機密，不能用 EXPO_PUBLIC_ 開頭、不能進 git）：
 *   LINE_CHANNEL_ID           LINE MINI App 頻道的 Channel ID
 *   FIREBASE_SERVICE_ACCOUNT  Firebase 服務帳戶金鑰（整份 JSON 貼上）
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (status: number, error: string) => Response.json({ error }, { status });

function admin(serviceAccount: string) {
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  return { auth: getAuth(app), db: getFirestore(app) };
}

/** 回傳 LINE 使用者 ID；token 無效或過期回傳 null */
async function verifyLineIdToken(idToken: string, channelId: string) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  return isRecord(data) && typeof data.sub === 'string' && data.sub ? data.sub : null;
}

/** 網頁目前的匿名帳號（第一次綁 LINE 時沿用）；不是匿名或驗證不過就不沿用 */
async function anonymousUid(auth: Auth, idToken: unknown) {
  if (typeof idToken !== 'string') return null;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.firebase.sign_in_provider === 'anonymous' ? decoded.uid : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const channelId = process.env.LINE_CHANNEL_ID;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!channelId || !serviceAccount) return fail(500, '伺服器還沒設定好 LINE 登入');

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.idToken !== 'string') return fail(400, '缺少 LINE 登入資料');

  const sub = await verifyLineIdToken(body.idToken, channelId);
  if (!sub) return fail(401, 'LINE 登入已過期，請重新打開');

  try {
    const { auth, db } = admin(serviceAccount);
    const adopt = await anonymousUid(auth, body.firebaseIdToken);
    const ref = db.collection('lineAccounts').doc(sub);
    // 同一個 LINE 帳號同時從兩台裝置登入時，只會有一個 uid
    const uid = await db.runTransaction(async (tx) => {
      const existing: unknown = (await tx.get(ref)).get('uid');
      if (typeof existing === 'string') return existing;
      const next = adopt ?? `line:${sub}`;
      tx.set(ref, { uid: next, createdAt: FieldValue.serverTimestamp() });
      return next;
    });
    const token = await auth.createCustomToken(uid, { lineSub: sub });
    return Response.json({ token, uid });
  } catch (e) {
    console.error('LINE 登入失敗', e);
    return fail(500, 'LINE 登入失敗，請稍後再試');
  }
}
