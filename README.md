# 📌 貼貼公布欄（TieTie Board）

家人、社團用的共享白板公布欄。iPhone、Android、網頁共用同一套程式（Expo）。

## 功能

- **多個公布欄**：同時加入家裡、社團好幾個公布欄，點左上角的名稱切換，或用邀請碼加入 / 建立新的
- **LINE 一點就加入**：把邀請連結貼到 LINE 家庭群組，家人點開就在 LINE 裡打開公布欄，用自己的 LINE 名字和大頭貼直接加入（不用取暱稱、不用輸入邀請碼）
- **Google 登入當備案**：在電腦上看、或沒有 LINE 的人用 Google 帳號登入，一樣帶入名字和大頭貼（設定方式見下面「登入方式」）
- **自由白板**：像 Figma 一樣拖曳移動、拖四個角調整大小、雙指 / Ctrl＋滾輪縮放
- **便利貼、圖片、貼圖**：圖片會自動壓縮後存進 Firestore（不需要 Firebase 付費方案）
- **重要公告**：分「重要」「緊急」，每個人都要按「我知道了」；發文的人看得到誰還沒看
- **日期時間**：公告可以設活動時間，白板、小工具都會倒數，並在前一天、前一小時、準時發通知
- **桌面小工具**
  - 每個加入的公布欄一頁：按 ‹ › 切換（iOS 大尺寸下面還有分頁），點一下打開那個公布欄
  - 即時更新：App 開著時馬上更新；App 沒開時，有人發新公告、改活動或快速通報，會用推播叫醒 App 在背景更新
  - iOS：小 / 中 / 大 / iPad 特大，加上鎖定畫面；時間到了會自動換下一件事；切換要 iOS 17 以上
  - Android：可自由拉伸大小，每個小工具可以停在不同的公布欄，每 30 分鐘也會自己抓最新資料
- **快速通報**：按右上角的 📣（或小工具上的「📣 通報」），一鍵送出「開飯囉」「我到家了」「緊急！請馬上看手機」…
  - 每個人的手機跳通知，桌面小工具整個變色顯示通報（30 分鐘後恢復），就算正在看別的公布欄也會切過來
  - App 裡會跳出卡片，按「收到 👍」；發通報的人看得到幾個人收到了
- **新公告推播**：有人發「重要 / 緊急」公告時，其他人會收到通知
- 公告的內容或時間被修改後，大家要重新確認
- **公告小幫手（寵物系統）**
  - 捏寵物：狗狗、貓咪、兔兔、熊熊、倉鼠，7 種毛色、6 種配件，還能取名字
  - 小幫手會用自己的口頭禪念出你還沒看的公告；點牠會跳起來冒愛心
  - 確認公告 +2、發公告 +1 經驗值，升級會有慶祝動畫（Lv.1 見習小幫手 → 傳說級管家）
  - 頂部顯示全家的寵物，還有公告沒看的人，寵物會露出擔心的表情
  - 桌面小工具也會出現小幫手的提醒

## 權限設計

| 動作 | 誰可以 |
|---|---|
| 移動、調整大小、調整圖層 | 所有成員 |
| 修改內容、刪除 | 只有發文的人 |
| 按「我知道了」、通報的「收到」 | 每個人只能幫自己按 |
| 快速通報 | 所有成員都能發（只能用自己的名義、時間由伺服器決定、最多 40 字），只有發的人能刪 |
| 推播代碼 | 每個人只能記自己的 |
| 頭像 | 每個人只能改自己的，而且只能是 LINE / Google 大頭貼網址（`profile.line-scdn.net`、`lh3.googleusercontent.com`） |
| LINE 帳號對照表（`lineAccounts`） | 只有伺服器（`/api/line-login`）能讀寫 |

規則在 `firestore.rules`。

## 本機開發（不需要 Firebase 帳號）

```bash
npm install
npm run emulators   # 終端機 1：啟動 Firebase 模擬器（需要 Java，會自動用 Android Studio 內建的）
npm run dev:web     # 終端機 2：開網頁版 http://localhost:8081
```

## 正式環境（家人實際使用中）

- 網址：<https://tietie-board.vercel.app>（Vercel 專案 `tietie-board`）
- Firebase 專案：`tietie-board`（免費 Spark 方案，Firestore 在台灣 `asia-east1`）
- 匿名登入的「自動清理」**不要開**：成員身分綁在匿名帳號上，清掉就會變成陌生人
- 瀏覽器 API key 在 Google Cloud 只開放 Cloud Firestore、Identity Toolkit、Token Service 三種 API

### 自動部署

**推到 `main` 就會自動更新網站**（Vercel 連著 GitHub，大約 1～2 分鐘）。其他分支不會部署（見 `vercel.json` 的 `git.deploymentEnabled`）。

- Firebase 設定值放在 Vercel 專案的環境變數（Production），**不在 GitHub 上**（repo 是公開的）。
  本機開發用的 `.env` 一樣不進 git。
- 這些 `EXPO_PUBLIC_` 值會打包進網頁，本來就是公開的；真正擋外人的是 `firestore.rules` 和 API key 的限制。
- 部署失敗時，到 Vercel 專案的 Deployments 頁看紀錄；網站會維持上一個成功的版本。

權限規則**不會**自動部署（改錯可能讓資料外洩或全家打不開，而且自動部署要把 Firebase 管理金鑰放上 GitHub），
改了 `firestore.rules` 要手動上傳（需要先 `npx firebase-tools login`）：

```bash
npm run deploy:rules
```

## 自己架一套 Firebase

1. 到 <https://console.firebase.google.com> 建立專案
2. **Authentication** → 登入方式 → 啟用「匿名」
3. **Firestore Database** → 建立資料庫
4. 專案設定 → 新增「網頁應用程式」，把設定值填進專案根目錄的 `.env`：

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

5. 上傳權限規則：`npx firebase-tools login` 後執行
   `npx firebase-tools deploy --only firestore:rules --project <你的專案 ID>`

## 在手機上執行

桌面小工具需要原生程式，不能用 Expo Go，要用 development build：

```bash
npx expo run:ios       # 需要 Xcode
npx expo run:android   # 需要 Android Studio
```

或用 EAS 雲端建置（不需要本機 Xcode）：`npx eas-cli@latest build --profile development`

> 資料夾名稱有中文，CocoaPods 需要 UTF-8：執行前先 `export LANG=en_US.UTF-8`
>
> iOS 小工具（expo-widgets）用到 iOS 26 的 API，本機建置需要 **Xcode 26 以上**；Xcode 比較舊的話改用 EAS 雲端建置。
>
> Android 的小工具用 react-native-android-widget，所以 `package.json` 的 `expo.autolinking.android.exclude` 讓 Android 不連結 expo-widgets：
> 兩個一起連結時 WorkManager 的類別會重複（`work-runtime` 與 `work-runtime-ktx`），Android 會編譯失敗。

### 推播設定（快速通報、小工具背景更新要用）

推播透過 Expo 的免費推播服務轉送，不需要自己的伺服器，但要先完成下面幾步（只要做一次），之後重新建置 App：

1. `npx eas-cli@latest init`：建立 EAS 專案，會把 `extra.eas.projectId` 寫進 `app.json`（沒有它就拿不到推播代碼，App 會在主控台提示）
2. iOS：用 EAS 建置時選擇讓 EAS 管理 Push Notifications 金鑰（`npx eas-cli@latest credentials` 也可以設定）
3. Android：在 Firebase 專案新增 Android 應用程式（套件名稱 `com.huanglingcheng.tietieboard`），
   下載 `google-services.json` 放到專案根目錄、在 `app.json` 的 `android` 加上 `"googleServicesFile": "./google-services.json"`，
   再到 Firebase 專案設定 → 服務帳戶 產生 FCM V1 金鑰，用 `npx eas-cli@latest credentials` 上傳

注意：
- 網頁版可以「送」通報與推播，但網頁版本身收不到推播（開著網頁時一樣會即時看到通報卡片）
- iOS 對背景推播有次數限制，而且使用者手動把 App 滑掉後就不會在背景叫醒；這時通知照樣會跳，小工具等下次打開 App 再更新
- 推播代碼記在 `groups/{邀請碼}/members/{uid}` 的 `pushToken`，只有同一個公布欄的成員讀得到

## 登入方式：LINE 為主、Google 備案

| 在哪裡打開 | 登入方式 |
|---|---|
| LINE 裡（從家庭群組點邀請連結） | 自動用 LINE 登入，什麼都不用按 |
| 電腦或手機的一般瀏覽器 | 「用 LINE 登入」或「沒有 LINE？用 Google 登入」，也可以不登入、自己取暱稱 |
| 手機 App | 目前還是匿名登入、自己取暱稱 |

登入後名字和大頭貼跟著帳號走；換手機、換電腦，用同一個 LINE / Google 帳號登入就還是同一個人。
已經加入公布欄的匿名成員，可以在「我的公布欄」（點左上角的名稱）最下面登入，原本的公布欄、便利貼都會留著。

### LINE 登入（家庭群組一點就加入）

網頁版用 LINE 的 **LIFF** 在 LINE 裡打開：家人在 LINE 群組點邀請連結
`https://liff.line.me/{LIFF ID}?join=邀請碼`，就會在 LINE 裡打開公布欄、用 LINE 的名字和大頭貼直接加入。
沒設定 `EXPO_PUBLIC_LIFF_ID` 時一切照舊（匿名登入、自己取暱稱、輸入邀請碼）。

運作方式：

1. 網頁在 LINE 裡打開時 `liff.init()` 自動登入 LINE，拿到 ID token、名字、大頭貼（`src/lib/liff.ts`）
2. 把 ID token 交給 Vercel Function `api/line-login.ts`，它向 LINE 驗證後發一張 Firebase custom token
3. 網頁用 `signInWithCustomToken` 登入（`src/lib/sign-in.ts`）
   - 這台裝置原本是匿名成員：沿用同一個 uid，公布欄、便利貼、確認紀錄都留著
   - 同一個 LINE 帳號在別台裝置登入：換回同一個 uid（對照表在 Firestore 的 `lineAccounts/{LINE 使用者 ID}`）
4. LINE 換了名字或大頭貼，下次打開會自動更新到每個加入的公布欄
5. 在 LINE 裡打開時，「家人」面板多一個「傳到 LINE 聊天室」按鈕（LINE 的分享對象選擇器）

設定步驟（只要做一次）：

1. **LINE Developers Console**（<https://developers.line.biz/console/>）建立 Provider，再建立 **LINE Login** 頻道（地區選台灣、App types 勾 Web app）
   - 台灣的 LINE MINI App 頻道要先經過 LINE 台灣核准，所以用 LINE Login 頻道 + LIFF
   - **LIFF** 分頁 → Add：Size 選 Full、Endpoint URL 填 `https://tietie-board.vercel.app`、Scopes 勾 `openid` 和 `profile`
   - 同一頁打開 **shareTargetPicker**（「傳到 LINE 聊天室」按鈕要用）
   - 頻道狀態從 **Developing** 切成 **Published**（Developing 只有管理員和測試人員能登入）
   - **Channel ID** 在「Basic settings」分頁
2. **Firebase 主控台** → 專案設定 → 服務帳戶 → 產生新的私密金鑰（下載一個 JSON 檔）
   - 這是管理者金鑰，**不能進 git、不能貼到聊天或文件裡**，只貼到 Vercel 的環境變數，貼完就把檔案刪掉
3. **Vercel 專案** → Settings → Environment Variables（Production）新增：

   | 名稱 | 值 | 說明 |
   |---|---|---|
   | `EXPO_PUBLIC_LIFF_ID` | LIFF ID | 會打包進網頁（本來就是公開的） |
   | `LINE_CHANNEL_ID` | Channel ID | 只有伺服器用，驗證 LINE 的 ID token |
   | `FIREBASE_SERVICE_ACCOUNT` | 服務帳戶 JSON 整份貼上 | 只有伺服器用，勾選 Sensitive |

4. 上傳權限規則：`npm run deploy:rules`
5. 推到 `main`（或在 Vercel 重新部署一次），`EXPO_PUBLIC_` 變數要重新建置才會生效

注意：
- 在 LINE 裡打開的網頁收不到推播（跟一般網頁版一樣），快速通報的推播還是要裝 App 才收得到
- 這台裝置的匿名成員搬到 LINE 身分時，用舊身分發的便利貼之後就不能再編輯（作者是舊的 uid）
- 伺服器函式跑在東京（`vercel.json` 的 `regions`），離 LINE 和 Firestore（台灣）比較近

### Google 登入（備案）

用 Firebase 內建的 Google 登入（免費方案就能用），不需要伺服器。

- 用彈出視窗登入：網站在 Vercel、不在 Firebase 的網域上，換頁的登入方式在 Safari / Chrome 擋第三方 Cookie 時會失敗
- 匿名成員按「用 Google 登入」會直接綁上 Google，uid 不變；這個 Google 帳號在別台裝置用過的話，會換回那個身分（跟 LINE 一樣搬過去）
- LINE 內建瀏覽器裡不顯示 Google 按鈕（Google 不允許在 App 內嵌的瀏覽器登入），那裡本來就自動用 LINE 登入
- 已經用 Google 登入的人點了 LINE 邀請連結，會照樣加入公布欄，不會被換成 LINE 帳號

設定步驟（只要做一次）：

1. **Firebase 主控台** → Authentication → 登入方式 → 新增「Google」，填支援電子郵件後啟用
2. Authentication → 設定 → **授權網域**：加入 `tietie-board.vercel.app`（沒加會顯示「這個網址還沒加進 Firebase 的授權網域」）
3. 如果 Google Cloud 的瀏覽器 API key 有設「網站限制（HTTP referrer）」，要加上 `tietie-board.firebaseapp.com/*`（登入視窗是從這個網域開的）

## 檔案結構

```
src/app/                  畫面路由（Expo Router），只負責決定顯示哪個畫面
src/features/board/       白板：Canvas（平移縮放）、CanvasItem（拖曳縮放）、編輯視窗、排隊模式…
src/features/setup/       加入公布欄：第一次使用（LINE / Google 登入或取暱稱、建立 / 加入群組）、邀請連結、切換 / 新增公布欄
src/features/widgets/     桌面小工具：BoardWidget.tsx（iOS，JSX → SwiftUI）、android/（Android）、資料轉換與同步、收到推播時背景更新
src/features/alerts/      快速通報：通報面板、App 裡的通報卡片、推播（送出、註冊推播代碼、點通知打開公布欄）
src/features/pet/         公告小幫手：外觀（SVG）、捏寵物、提醒台詞、等級（尚未接到畫面上）
src/components/           共用 UI：配色字型、按鈕、底部面板、頭像、對話框
src/lib/                  共用基礎：Firebase、資料存取（repo.ts）、型別、日期、錯誤訊息、提醒通知、登入（sign-in.ts、LINE：line.ts、liff.ts）
api/line-login.ts         Vercel Function：驗證 LINE 登入，發 Firebase 登入憑證
firestore.rules           資料庫權限規則
```

依賴方向只能 `app → features → components → lib`，由 `eslint.config.js` 檢查（`npm run lint`）。
完整的架構規範在 `.claude/skills/expo-app-architect/SKILL.md`。

## 之後可以加

- iOS 即時動態（Live Activity）：緊急公告常駐在鎖定畫面 / 動態島
- 看板模式：舊平板放在冰箱上，全螢幕輪播公告
