/**
 * Vercel Function：/api/oauth
 * 手機 App 用 LINE / Google 登入。App 裡沒有 LIFF（只能在 LINE 內建瀏覽器用），也開不了 Firebase 的 Google 彈出視窗，
 * 所以用系統瀏覽器走一般的 OAuth 登入（authorization code + PKCE，App 端見 src/lib/oauth.ts）：
 *
 * 1. GET ?provider=line|google&state=…&challenge=…：App 打開這裡，轉到 LINE / Google 的登入頁
 *    （client ID 只設定在伺服器，App 不用另外打包設定值）
 * 2. GET ?code=…&state=…（或 ?error=…）：登入完 LINE / Google 轉回這裡，顯示一頁「回到 App」，把 code 帶回 tietieboard://oauth
 *    （Chrome 不一定讓網頁自己跳回 App，例如 LINE 自動登入時使用者什麼都沒按，所以留一個按鈕）
 * 3. POST { provider, code, codeVerifier }：用 code 換 ID token（要 channel secret / client secret，只能在伺服器做）
 *    - PKCE：codeVerifier 只有發起登入的 App 知道，code 被別的 App 攔到也換不到
 *    - LINE 的 ID token 再交給 /api/line-login 換 Firebase 登入憑證；Google 的由 App 直接登入 Firebase
 *
 * 環境變數（Vercel 專案設定；是機密，不能用 EXPO_PUBLIC_ 開頭、不能進 git）：
 *   LINE_CHANNEL_ID / LINE_CHANNEL_SECRET    LINE Login 頻道（跟 /api/line-login 同一個頻道）
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  Google Cloud 的「Web client (auto created by Google Service)」，
 *                                            Firebase 認得這個 client 發的 ID token
 * LINE 頻道的 Callback URL、Google client 的「已授權的重新導向 URI」都要加上 https://tietie-board.vercel.app/api/oauth
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** 登入完跳回 App 的網址（app.json 的 scheme） */
const RETURN_URL = 'tietieboard://oauth';

/** state、PKCE 的 challenge / verifier：App 產生的亂數 */
const NONCE = /^[A-Za-z0-9._~-]{16,128}$/;

type Provider = 'line' | 'google';

const asProvider = (v: unknown): Provider | null => (v === 'line' || v === 'google' ? v : null);

/** LINE / Google 的登入頁、換 token 的網址與設定值；client ID 或 secret 沒設定時是 undefined */
interface ProviderConfig {
  name: string;
  authorize: string;
  token: string;
  scope: string;
  /** 登入頁額外的參數 */
  extra: Record<string, string>;
  clientId: string | undefined;
  secret: string | undefined;
}

function providerConfig(provider: Provider): ProviderConfig {
  if (provider === 'line') {
    return {
      name: 'LINE',
      authorize: 'https://access.line.me/oauth2/v2.1/authorize',
      token: 'https://api.line.me/oauth2/v2.1/token',
      scope: 'openid profile',
      extra: {},
      clientId: process.env.LINE_CHANNEL_ID,
      secret: process.env.LINE_CHANNEL_SECRET,
    };
  }
  return {
    name: 'Google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    // 手機上登入過好幾個 Google 帳號時，讓使用者選要用哪一個
    extra: { prompt: 'select_account' },
    clientId: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

/** 登入頁轉回來的網址，換 token 時要一模一樣 */
const redirectUri = (request: Request) => `${new URL(request.url).origin}/api/oauth`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 回到 App 的那一頁：自動跳回去，沒跳的話按按鈕 */
function backToApp(params: Record<string, string>, message: string) {
  const target = `${RETURN_URL}?${new URLSearchParams(params)}`;
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>貼貼公布欄</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;
font-family:system-ui,sans-serif;background:#FFF8EC;color:#3B3355;padding:24px;box-sizing:border-box;text-align:center}
p{font-size:18px;margin:0}
a{display:inline-block;background:#208AEF;color:#FFF;text-decoration:none;font-size:18px;padding:14px 28px;border-radius:999px}
</style>
</head>
<body>
<p>${escapeHtml(message)}</p>
<a href="${escapeHtml(target)}">回到貼貼公布欄</a>
<script>location.href = ${JSON.stringify(target).replace(/</g, '\\u003c')};</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 網址上有登入用的 code：不要快取、不要帶到別的網站
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

const decodeClaims = (jwt: string): Record<string, unknown> => {
  try {
    const data: unknown = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString());
    return isRecord(data) ? data : {};
  } catch {
    return {};
  }
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get('state') ?? '';
  const provider = asProvider(params.get('provider'));

  // 2. LINE / Google 登入完轉回來（使用者按取消時是 error=access_denied）
  if (!provider) {
    const code = params.get('code');
    if (code) return backToApp({ code, state }, '登入完成，正在回到貼貼公布欄…');
    return backToApp({ error: params.get('error') ?? 'invalid_request', state }, '沒有登入，回到貼貼公布欄');
  }

  // 1. App 打開登入頁
  const challenge = params.get('challenge') ?? '';
  if (!NONCE.test(state) || !NONCE.test(challenge)) return fail(400, '登入資料不完整，請回到 App 再試一次');
  const p = providerConfig(provider);
  if (!p.clientId || !p.secret) {
    const message = `伺服器還沒設定好 ${p.name} 登入`;
    return backToApp({ error: 'server_error', error_description: message, state }, message);
  }
  const url = new URL(p.authorize);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId,
    redirect_uri: redirectUri(request),
    scope: p.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...p.extra,
  }).toString();
  return Response.redirect(url.toString(), 302);
}

// 3. 用 code 換 ID token
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const provider = isRecord(body) ? asProvider(body.provider) : null;
  const code = isRecord(body) ? str(body.code) : null;
  const codeVerifier = isRecord(body) ? str(body.codeVerifier) : null;
  if (!provider || !code || code.length > 2048 || !codeVerifier || !NONCE.test(codeVerifier)) {
    return fail(400, '缺少登入資料');
  }
  const p = providerConfig(provider);
  if (!p.clientId || !p.secret) return fail(500, `伺服器還沒設定好 ${p.name} 登入`);

  try {
    const res = await fetch(p.token, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(request),
        client_id: p.clientId,
        client_secret: p.secret,
        code_verifier: codeVerifier,
      }),
    });
    const data: unknown = await res.json().catch(() => null);
    const idToken = isRecord(data) ? str(data.id_token) : null;
    if (!res.ok || !idToken) {
      // 只記錯誤代碼，不記整個回應
      const error = isRecord(data) ? str(data.error) : null;
      console.error(`${p.name} 換 ID token 失敗`, res.status, error);
      return fail(401, `${p.name} 登入已過期，請再試一次`);
    }
    // 剛剛直接跟 LINE / Google 換來的（HTTPS），讀名字頭像不用再驗簽章；要拿來登入時 /api/line-login、Firebase 會再驗
    const claims = decodeClaims(idToken);
    const sub = str(claims.sub);
    if (!sub) return fail(502, `${p.name} 登入失敗，請稍後再試`);
    return Response.json({ idToken, sub, name: str(claims.name), picture: str(claims.picture) });
  } catch (e) {
    console.error(`${p.name} 登入失敗`, e);
    return fail(500, `${p.name} 登入失敗，請稍後再試`);
  }
}
