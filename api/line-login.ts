import { sign, verify, X509Certificate } from 'node:crypto';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
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
 * 不用 firebase-admin/auth：它會 require() 只有 ES module 版的 jose，在 Vercel 上一載入就當掉。
 * 這裡只需要簽 custom token、驗匿名帳號的 ID token，照 Firebase 文件用 node:crypto 自己做。
 *
 * 環境變數（Vercel 專案設定；是機密，不能用 EXPO_PUBLIC_ 開頭、不能進 git）：
 *   LINE_CHANNEL_ID           LINE Login 頻道的 Channel ID
 *   FIREBASE_SERVICE_ACCOUNT  Firebase 服務帳戶金鑰（整份 JSON 貼上）
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (status: number, error: string) => Response.json({ error }, { status });

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function parseServiceAccount(json: string): ServiceAccount {
  const data: unknown = JSON.parse(json);
  if (
    !isRecord(data) ||
    typeof data.project_id !== 'string' ||
    typeof data.client_email !== 'string' ||
    typeof data.private_key !== 'string'
  ) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT 不是服務帳戶金鑰的 JSON');
  }
  return { projectId: data.project_id, clientEmail: data.client_email, privateKey: data.private_key };
}

const firestore = (sa: ServiceAccount) => getFirestore(getApps()[0] ?? initializeApp({ credential: cert(sa) }));

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

const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

const decode = (part: string | undefined): unknown => {
  try {
    return part ? JSON.parse(Buffer.from(part, 'base64url').toString()) : null;
  } catch {
    return null;
  }
};

/** Firebase custom token：用服務帳戶私鑰簽的 JWT，一小時內有效（欄位照 Firebase 文件） */
function createCustomToken(sa: ServiceAccount, uid: string, claims: Record<string, string>) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: sa.clientEmail,
    sub: sa.clientEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), sa.privateKey).toString('base64url')}`;
}

/** Google 簽 Firebase ID token 用的公鑰（照回應的 Cache-Control 快取，同一台機器不用每次都抓） */
let googleCerts: { certs: Record<string, string>; expires: number } | null = null;

async function googleCert(kid: string) {
  if (!googleCerts || googleCerts.expires <= Date.now()) {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!res.ok) throw new Error(`拿不到 Google 公鑰（${res.status}）`);
    const data: unknown = await res.json();
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 0);
    const certs = Object.entries(isRecord(data) ? data : {}).filter((e): e is [string, string] => typeof e[1] === 'string');
    googleCerts = { certs: Object.fromEntries(certs), expires: Date.now() + maxAge * 1000 };
  }
  return googleCerts.certs[kid] ?? null;
}

/** 網頁目前的匿名帳號（第一次綁 LINE 時沿用）；不是匿名、過期或驗證不過就不沿用 */
async function anonymousUid(idToken: unknown, projectId: string) {
  if (typeof idToken !== 'string') return null;
  const [header, payload, signature] = idToken.split('.');
  const h = decode(header);
  const p = decode(payload);
  if (!isRecord(h) || !isRecord(p) || signature === undefined) return null;
  const uid = typeof p.sub === 'string' ? p.sub : '';
  const valid =
    uid.length > 0 &&
    uid.length <= 128 &&
    p.aud === projectId &&
    p.iss === `https://securetoken.google.com/${projectId}` &&
    typeof p.exp === 'number' &&
    p.exp > Date.now() / 1000 &&
    isRecord(p.firebase) &&
    p.firebase.sign_in_provider === 'anonymous';
  if (!valid) return null;
  // 本機模擬器發的 token 沒有簽章（firebase-admin 也是這樣處理）
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return uid;
  if (h.alg !== 'RS256' || typeof h.kid !== 'string') return null;
  const pem = await googleCert(h.kid);
  if (!pem) return null;
  const data = Buffer.from(`${header}.${payload}`);
  return verify('RSA-SHA256', data, new X509Certificate(pem).publicKey, Buffer.from(signature, 'base64url')) ? uid : null;
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
    const sa = parseServiceAccount(serviceAccount);
    const db = firestore(sa);
    const adopt = await anonymousUid(body.firebaseIdToken, sa.projectId);
    const ref = db.collection('lineAccounts').doc(sub);
    // 同一個 LINE 帳號同時從兩台裝置登入時，只會有一個 uid
    const uid = await db.runTransaction(async (tx) => {
      const existing: unknown = (await tx.get(ref)).get('uid');
      if (typeof existing === 'string') return existing;
      const next = adopt ?? `line:${sub}`;
      tx.set(ref, { uid: next, createdAt: FieldValue.serverTimestamp() });
      return next;
    });
    return Response.json({ token: createCustomToken(sa, uid, { lineSub: sub }), uid });
  } catch (e) {
    console.error('LINE 登入失敗', e);
    return fail(500, 'LINE 登入失敗，請稍後再試');
  }
}
