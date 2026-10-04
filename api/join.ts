import { verify, X509Certificate } from 'node:crypto';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * Vercel Function：POST /api/join
 * 用 LINE 登入的人點邀請連結時，確認他在不在這個公布欄綁定的 LINE 群組裡；在的話直接加成成員，不用等房主同意。
 *
 * 1. 驗證 Firebase ID token：確定是哪個成員（uid），以及他的 LINE 使用者 ID（/api/line-login 發的憑證帶著 lineSub）
 * 2. 讀這個公布欄綁定的 LINE 群組（groups/{邀請碼}/lineGroups，房主把邀請連結貼到群組時 /api/line-webhook 記下來的）
 * 3. 用 LINE 官方帳號（Messaging API）問 LINE：這個人在不在群組裡（不用先加官方帳號好友）
 * 4. 在 → 用管理者權限寫成員資料、刪掉加入申請，回傳 { joined: true }；不在 → { joined: false }，App 改成送出申請
 *
 * LIFF 從 2023 年起不再告訴網頁「是從哪個聊天室打開的」，所以改成問「這個人在不在綁定的群組裡」：
 * 從群組點連結的家人一定在群組裡；連結被轉傳到別的地方，那邊的人不在群組裡，就要等房主同意。
 *
 * 跟 line-login.ts 一樣不用 firebase-admin/auth（在 Vercel 上一載入就當掉）；也不 import 那邊的小工具
 * （Vercel 打包時不一定會帶上 api/ 裡互相 import 的檔案），需要的都寫在這裡。
 *
 * 環境變數（Vercel 專案設定；是機密，不能用 EXPO_PUBLIC_ 開頭、不能進 git）：
 *   FIREBASE_SERVICE_ACCOUNT  Firebase 服務帳戶金鑰（跟 /api/line-login 同一份）
 *   LINE_BOT_ACCESS_TOKEN     LINE 官方帳號（Messaging API 頻道）的 Channel access token；沒設就一律走申請
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (status: number, error: string) => Response.json({ error }, { status });

const CODE = /^[A-Z0-9]{6}$/;
/** 頭像只接受 LINE / Google 的大頭貼網址（跟 Firestore 規則的 validAvatar 一樣） */
const AVATAR = /^https:\/\/(profile\.line-scdn\.net|lh3\.googleusercontent\.com)\/\S+$/;

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

const decode = (part: string | undefined): unknown => {
  try {
    return part ? JSON.parse(Buffer.from(part, 'base64url').toString()) : null;
  } catch {
    return null;
  }
};

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

/** 驗證 Firebase ID token（欄位照 Firebase 文件），回傳 uid 與綁定的 LINE 使用者 ID；過期或驗證不過回傳 null */
async function verifyIdToken(idToken: unknown, projectId: string) {
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
    p.exp > Date.now() / 1000;
  if (!valid) return null;
  const user = { uid, lineSub: typeof p.lineSub === 'string' ? p.lineSub : null };
  // 本機模擬器發的 token 沒有簽章（firebase-admin 也是這樣處理）
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return user;
  if (h.alg !== 'RS256' || typeof h.kid !== 'string') return null;
  const pem = await googleCert(h.kid);
  if (!pem) return null;
  const data = Buffer.from(`${header}.${payload}`);
  return verify('RSA-SHA256', data, new X509Certificate(pem).publicKey, Buffer.from(signature, 'base64url')) ? user : null;
}

/** 這個人在不在 LINE 群組裡（官方帳號要在群組裡才問得到；不在群組 LINE 回 404） */
async function inLineGroup(lineGroupId: string, lineUserId: string, botToken: string) {
  const url = `https://api.line.me/v2/bot/group/${encodeURIComponent(lineGroupId)}/member/${encodeURIComponent(lineUserId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${botToken}` } });
  if (res.ok) return true;
  if (res.status !== 404) console.warn('查 LINE 群組成員失敗', res.status, await res.text().catch(() => ''));
  return false;
}

export async function POST(request: Request) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) return fail(500, '伺服器還沒設定好');

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.code !== 'string' || !CODE.test(body.code)) return fail(400, '邀請碼格式不對');
  const code = body.code;
  // 名字最多 30 字（跟 LINE 登入、通報署名一樣）；管理者寫入不經過 Firestore 規則，這裡自己把關
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 30) : '';
  if (!name) return fail(400, '缺少名字');
  const avatarUrl = typeof body.avatarUrl === 'string' && AVATAR.test(body.avatarUrl) ? body.avatarUrl : null;

  try {
    const sa = parseServiceAccount(serviceAccount);
    const user = await verifyIdToken(body.idToken, sa.projectId);
    if (!user) return fail(401, '登入已過期，請重新打開');
    const botToken = process.env.LINE_BOT_ACCESS_TOKEN;
    // 沒用 LINE 登入、或還沒設定官方帳號：一律走申請
    if (!user.lineSub || !botToken) return Response.json({ joined: false });
    const { lineSub } = user;

    const group = firestore(sa).collection('groups').doc(code);
    const [snap, bound] = await Promise.all([group.get(), group.collection('lineGroups').get()]);
    if (!snap.exists) return fail(404, '找不到這個公布欄，可能已經被刪掉了');
    const checks = await Promise.all(bound.docs.map((d) => inLineGroup(d.id, lineSub, botToken)));
    if (!checks.includes(true)) return Response.json({ joined: false });

    const batch = group.firestore.batch();
    batch.set(
      group.collection('members').doc(user.uid),
      { name, ...(avatarUrl ? { avatarUrl } : null), joinedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batch.delete(group.collection('joinRequests').doc(user.uid));
    await batch.commit();
    return Response.json({ joined: true });
  } catch (e) {
    console.error('加入公布欄失敗', e);
    return fail(500, '加入失敗，請稍後再試');
  }
}
