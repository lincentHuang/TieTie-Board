import { createHmac, timingSafeEqual } from 'node:crypto';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * Vercel Function：POST /api/line-webhook（LINE 官方帳號 Messaging API 頻道的 Webhook URL）
 * 房主把邀請連結貼到有官方帳號的 LINE 群組 → 記下「這個公布欄綁定這個群組」，
 * 之後群組裡的人點連結就直接加入（/api/join 會問 LINE 他在不在群組裡）。
 *
 * - 只認房主貼的：貼的人的 LINE 帳號要對得上公布欄的房主（lineAccounts/{LINE 使用者 ID} 的 uid == ownerId），
 *   別人把連結轉貼到其他群組不算數
 * - 第一次綁定成功時在群組裡回一句話；官方帳號被加進群組時打聲招呼（回覆訊息不算進官方帳號每月的訊息則數）
 * - 官方帳號被踢出群組時不用特別處理：/api/join 問不到那個群組，就會改走申請
 *
 * 跟 line-login.ts 一樣，需要的小工具都寫在這裡（Vercel 打包時不一定會帶上 api/ 裡互相 import 的檔案）。
 *
 * 環境變數（Vercel 專案設定；是機密，不能用 EXPO_PUBLIC_ 開頭、不能進 git）：
 *   FIREBASE_SERVICE_ACCOUNT  Firebase 服務帳戶金鑰（跟 /api/line-login 同一份）
 *   LINE_BOT_CHANNEL_SECRET   Messaging API 頻道的 Channel secret（確認請求真的是 LINE 送來的）
 *   LINE_BOT_ACCESS_TOKEN     Messaging API 頻道的 Channel access token（回覆訊息用）
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === 'string' ? v : null);

/** 邀請連結 https://liff.line.me/{LIFF ID}?join=邀請碼（src/lib/line.ts 的 lineInviteLink） */
const INVITE_LINK = /[?&]join=([A-Z0-9]{6})\b/g;

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

type Db = ReturnType<typeof firestore>;

/** LINE 用 Channel secret 對整段內容簽名（HMAC-SHA256，base64），放在 x-line-signature */
function signedByLine(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function reply(replyToken: string, text: string, botToken: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) console.warn('LINE 回覆失敗', res.status, await res.text().catch(() => ''));
}

/** 房主貼的邀請連結：綁定這個群組，回傳第一次綁定的公布欄名稱 */
async function bindInvites(db: Db, text: string, lineGroupId: string, lineUserId: string) {
  const codes = [...new Set(Array.from(text.matchAll(INVITE_LINK), (m) => m[1]))].slice(0, 3);
  if (!codes.length) return [];
  const poster = str((await db.collection('lineAccounts').doc(lineUserId).get()).get('uid'));
  if (!poster) return [];
  const bound = await Promise.all(
    codes.map(async (code) => {
      const group = await db.collection('groups').doc(code).get();
      if (!group.exists || group.get('ownerId') !== poster) return null;
      const ref = group.ref.collection('lineGroups').doc(lineGroupId);
      if ((await ref.get()).exists) return null;
      await ref.set({ boundAt: FieldValue.serverTimestamp(), boundBy: poster });
      return str(group.get('name')) ?? '公布欄';
    }),
  );
  return bound.filter((name): name is string => name !== null);
}

async function handle(db: Db, event: Record<string, unknown>, botToken: string) {
  const source = isRecord(event.source) ? event.source : {};
  const replyToken = str(event.replyToken);
  const lineGroupId = str(source.groupId);
  if (source.type !== 'group' || !lineGroupId || !replyToken) return;

  if (event.type === 'join') {
    const hello =
      '大家好！我是公布欄小幫手 📌\n房主把公布欄的邀請連結貼到這個群組後，群組裡的人點連結就能直接加入，不用等房主同意。';
    return reply(replyToken, hello, botToken);
  }

  const message = isRecord(event.message) ? event.message : {};
  const text = str(message.text);
  // 貼文的人的 LINE 使用者 ID（電腦版 LINE 有時候沒有，就沒辦法確認是不是房主）
  const lineUserId = str(source.userId);
  if (event.type !== 'message' || message.type !== 'text' || !text || !lineUserId) return;
  const names = await bindInvites(db, text, lineGroupId, lineUserId);
  if (names.length) {
    const boards = names.map((n) => `「${n}」`).join('、');
    return reply(replyToken, `✅ ${boards}公布欄綁定這個群組了！群組裡的人點邀請連結就會直接加入，不用等房主同意。`, botToken);
  }
}

export async function POST(request: Request) {
  const secret = process.env.LINE_BOT_CHANNEL_SECRET;
  const botToken = process.env.LINE_BOT_ACCESS_TOKEN;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!secret || !botToken || !serviceAccount) return Response.json({ error: '伺服器還沒設定好 LINE 官方帳號' }, { status: 500 });

  const raw = await request.text();
  if (!signedByLine(raw, request.headers.get('x-line-signature'), secret)) {
    return Response.json({ error: '簽章不對' }, { status: 401 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: '格式不對' }, { status: 400 });
  }
  const events = isRecord(body) && Array.isArray(body.events) ? body.events.filter(isRecord) : [];
  // LINE 後台按「Verify」時送的是空的 events
  if (!events.length) return Response.json({ ok: true });

  const db = firestore(parseServiceAccount(serviceAccount));
  // 一則訊息出錯不影響其他的；LINE 只要收到 200 就不會重送
  await Promise.all(events.map((e) => handle(db, e, botToken).catch((err) => console.error('處理 LINE 事件失敗', err))));
  return Response.json({ ok: true });
}
