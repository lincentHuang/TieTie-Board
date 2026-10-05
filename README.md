# 📌 貼貼公布欄（TieTie Board）

家人、社團用的共享白板公布欄。iPhone、Android、網頁共用同一套程式（Expo）。

## 功能

- **多個公布欄**：同時加入家裡、社團好幾個公布欄，點左上角的名稱切換，或用邀請碼加入 / 建立新的
- **LINE 一點就加入**：把邀請連結貼到 LINE 家庭群組，家人點開就在 LINE 裡打開公布欄，用自己的 LINE 名字和大頭貼直接加入（不用取暱稱、不用輸入邀請碼）
- **加入審核**：群組裡有公布欄的 LINE 官方帳號時，**群組成員**點邀請連結直接加入；其他人（自己輸入邀請碼、連結被轉傳到別的地方）要等房主在「家人」面板按同意（設定方式見下面「加入審核」）
- **Google 登入當備案**：在電腦上看、或沒有 LINE 的人用 Google 帳號登入，一樣帶入名字和大頭貼（設定方式見下面「登入方式」）
- **自由白板**：像 Figma 一樣拖曳移動、拖四個角調整大小、雙指 / Ctrl＋滾輪縮放
  - 點兩下卡片打開檢視模式（完整內容、照片、附件、誰還沒看）；要改的話再按「編輯」
  - 卡片會長腳：拖著走時腳在下面跑（拖越快跑越快），撞到別張會把它推開
  - 還沒看的公告會慢慢走到畫面中間（擋路的卡片被擠開），越緊急越常站起來跺腳，點一下就收起腳；按「我知道了」後走回原位（只在自己的畫面上，不會改到大家的排版）
- **便利貼、圖片、貼圖**：圖片會自動壓縮後存進 Firestore（不需要 Firebase 付費方案）
- **附件（PDF、Word、Excel、PowerPoint）**：便利貼 / 公告可以附最多 5 個檔案，每個最多 10MB
  - PDF 點一下直接在 App 裡看（上下捲動、兩指或點兩下放大），其他檔案下載下來（手機 App 是「用其他 App 開啟」）
  - 檔案切成每片 900KB 存在 Firestore（`groups/{邀請碼}/files/{檔案 id}/chunks/{0、1…}`），一樣不需要付費方案；點開時才下載，刪掉項目會一起清掉
  - PDF 檢視器用 PDF.js（從 jsDelivr CDN 載入，所以看 PDF 要有網路）
- **重要公告**：分「重要」「緊急」，每個人都要按「我知道了」；發文的人看得到誰還沒看
- **日期時間**：公告可以設活動時間，白板、小工具都會倒數，並在前一天、前一小時、準時發通知
- **桌面小工具**
  - 每個加入的公布欄一頁：按 ‹ › 切換（iOS 大尺寸下面還有分頁），點一下打開那個公布欄
  - 即時更新：App 開著時馬上更新；App 沒開時，有人發新公告、改活動或快速通報，會用推播叫醒 App 在背景更新
  - iOS：小 / 中 / 大 / iPad 特大，加上鎖定畫面；時間到了會自動換下一件事；切換要 iOS 17 以上
  - Android：可自由拉伸大小，每個小工具可以停在不同的公布欄，每 30 分鐘也會自己抓最新資料
- **快速通報**：按右上角的 📣（或小工具上的「📣 通報」），一鍵送出「開飯囉」「我到家了」「緊急！請馬上看手機」…
  - 按鈕可以自己新增、修改、刪除、排順序（每個人一組，跟著帳號走）；送錯了再點一下就收回
  - 每個人的手機跳通知，桌面小工具整個變色顯示通報（30 分鐘後恢復），就算正在看別的公布欄也會切過來
  - App 裡會跳出卡片，按「收到 👍」；發通報的人看得到幾個人收到了
- **新公告推播**：有人發「重要 / 緊急」公告時，其他人會收到通知
- 公告的內容或時間被修改後，大家要重新確認
- **設定**（右上角的齒輪）：裝到手機、我的帳號（LINE / Google 登入）、版本；之後新的設定也放這裡
- **裝到手機**：用手機瀏覽器（或 LINE 裡）打開網頁版時，白板下方會提醒「把公布欄裝到手機」，按 ✕ 一週內不再出現，設定裡一直找得到（設定方式見下面「裝到手機」）
  - Android：下載 App（APK，收得到通知、有桌面小工具）或加到主畫面（PWA）
  - Android 已經裝了 App：在 LINE 裡一鍵改用 App 打開，也可以設定「以後點 LINE 裡的連結，直接用 App 打開」
  - iPhone / iPad：教你用分享按鈕「加入主畫面」；在 LINE 裡加入公布欄後會提醒「從主畫面打開也看得到」（iOS 不讓連結打開主畫面上的網頁）
  - 在 LINE 裡：LINE 裡不能安裝，先一鍵換成手機的瀏覽器打開
- **公告小幫手（寵物系統）**
  - 捏寵物：狗狗、貓咪、兔兔、熊熊、倉鼠，7 種毛色、6 種配件，還能取名字
  - 小幫手會用自己的口頭禪念出你還沒看的公告；點牠會跳起來冒愛心
  - 確認公告 +2、發公告 +1 經驗值，升級會有慶祝動畫（Lv.1 見習小幫手 → 傳說級管家）
  - 頂部顯示全家的寵物，還有公告沒看的人，寵物會露出擔心的表情
  - 桌面小工具也會出現小幫手的提醒

## 權限設計

| 動作 | 誰可以 |
|---|---|
| 移動、調整大小、調整圖層、改狀態和標籤 | 所有成員 |
| 修改內容 | 發文的人、房主；其他人要先送編輯申請，發文的人同意後才能改那一則（不能改作者、類型，也不能再加別人進來；改了公告，大家要重新按「我知道了」） |
| 刪除 | 發文的人、房主 |
| 編輯申請（`editRequests`） | 每個人只能用自己的名義申請改別人的項目；只有申請的人和發文的人看得到；發文的人同意或拒絕，申請的人可以收回 |
| 按「我知道了」、通報的「收到」 | 每個人只能幫自己按 |
| 快速通報 | 所有成員都能發（只能用自己的名義、時間由伺服器決定、最多 40 字），只有發的人能刪（收回） |
| 快速通報按鈕（`users/{uid}/settings/quickAlerts`） | 每個人自己的一組按鈕（最多 12 顆），只有自己能讀寫；刪掉就恢復預設的按鈕 |
| 推播代碼 | 每個人只能記自己的 |
| 頭像 | 每個人只能改自己的，而且只能是 LINE / Google 大頭貼網址（`profile.line-scdn.net`、`lh3.googleusercontent.com`） |
| 加入公布欄（新增成員） | 只有房主（建立的人）；LINE 群組成員由伺服器（`/api/join`）確認後加入 |
| 加入申請（`joinRequests`） | 每個人只能用自己的名義送、可以收回；只有房主看得到全部、可以同意或拒絕 |
| LINE 帳號對照表（`lineAccounts`）、綁定的 LINE 群組（`lineGroups`） | 只有伺服器能讀寫 |
| 我的公布欄清單（`users/{uid}`） | 只有自己能讀寫；只是索引，讀不讀得到公布欄還是看是不是成員 |

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

推到 `main` 就會自動更新，其他分支不會部署：

| 部署什麼 | 怎麼部署 | 什麼時候 |
|---|---|---|
| 網站 | Vercel 連著 GitHub（見 `vercel.json` 的 `git.deploymentEnabled`） | 每次推到 `main`，大約 1～2 分鐘 |
| 權限規則（`firestore.rules`） | GitHub Actions（`.github/workflows/deploy-rules.yml`） | 推到 `main` 而且 `firestore.rules` 有改；也可以在 GitHub 的 Actions 頁面手動按「Run workflow」 |

- Firebase 設定值放在 Vercel 專案的環境變數（Production），**不在 GitHub 上**（repo 是公開的）。
  本機開發用的 `.env` 一樣不進 git。
- 這些 `EXPO_PUBLIC_` 值會打包進網頁，本來就是公開的；真正擋外人的是 `firestore.rules` 和 API key 的限制。
- 網站部署失敗時，到 Vercel 專案的 Deployments 頁看紀錄；網站會維持上一個成功的版本。
- 權限規則上傳前 Firebase 會先編譯，寫錯會直接失敗（GitHub 寄信通知），正式環境維持原本的規則；
  但「語法對、邏輯錯」的規則會照樣上去，改規則前先用模擬器（`npm run emulators` + `npm run dev:web`）實際操作過。
- Android App（APK）不會自動建置，發新版的方式見下面「裝到手機」。

#### 權限規則自動部署的金鑰（只要設定一次）

GitHub Actions 用一個**只能改權限規則**的服務帳號上傳（不能讀寫資料、不能改其他設定），金鑰放在 GitHub 的 Secrets，不在程式碼裡：

1. 到 Google Cloud 建立服務帳號：<https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=tietie-board>
   - 名稱：`github-rules-deployer`
   - 角色加兩個：**Firebase Rules Admin**（上傳規則）、**Service Usage Consumer**（檢查 Firestore API 有沒有開）
2. 點進建好的服務帳號 → 「金鑰」→「新增金鑰」→「建立新的金鑰」→ JSON，會下載一個 `.json` 檔
3. 把金鑰存到 GitHub，然後**刪掉下載的檔案**：

   ```bash
   gh secret set FIREBASE_SERVICE_ACCOUNT --repo lincentHuang/TieTie-Board < 下載的金鑰.json
   rm 下載的金鑰.json
   ```

4. 到 GitHub 的 Actions 頁面 →「部署 Firestore 權限規則」→「Run workflow」，跑一次確認設定成功

金鑰外洩或不用了：到同一個服務帳號的「金鑰」頁刪掉它，再照上面重新建一把。

自動部署壞掉、或想馬上上傳時，本機一樣可以手動上傳（需要先 `npx firebase-tools login`）：

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
| 手機 App | 「用 LINE 登入」或「沒有 LINE？用 Google 登入」（用手機的瀏覽器登入完回到 App），也可以不登入、自己取暱稱 |

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
   - 加入過的公布欄也跟著帳號走：清單記在 Firestore 的 `users/{uid}`，登入時跟這台裝置記得的合併（`src/lib/account-boards.ts`）；改版前加入的，在原本那台裝置打開一次就會補記上去
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

### 加入審核（LINE 群組成員免審核）

| 怎麼加入的 | 結果 |
|---|---|
| 用 LINE 登入、在房主綁定的 LINE 群組裡（從家庭群組點邀請連結） | 直接加入 |
| 其他（自己輸入邀請碼、Google / 匿名、連結被轉傳到別的群組） | 送出申請，房主在「家人」面板按「同意」後自動加入 |

- 房主的家人按鈕上會顯示有幾個人在等；申請的人在「我的公布欄」看得到「等房主同意」，可以收回
- 沒設定 LINE 官方帳號時，所有人都走申請

為什麼要官方帳號：LIFF 從 2023 年起不再告訴網頁「是從哪個聊天室打開的」，沒辦法從連結本身知道是哪個群組。
所以改成讓 LINE 官方帳號待在家庭群組裡，用它問 LINE「這個人在不在群組裡」——從群組點連結的家人一定在群組裡，連結被轉傳出去，那邊的人不在群組裡，就要等房主同意。

運作方式：

1. 房主把邀請連結貼到有官方帳號的 LINE 群組 → `api/line-webhook.ts` 收到訊息，確認貼的人就是房主（`lineAccounts` 對得上 `ownerId`），記下 `groups/{邀請碼}/lineGroups/{LINE 群組 ID}`，並在群組回一句「已綁定」
   - 別人把連結轉貼到其他群組不算數；同一個公布欄可以綁好幾個群組
2. 家人點連結 → 網頁用 LINE 登入後呼叫 `api/join.ts` → 它用官方帳號查「這個人在不在綁定的群組裡」（不用先加官方帳號好友），在就直接寫成員資料
3. 不在 → App 寫一筆 `joinRequests/{uid}`，房主同意時同一次寫入加成員、刪申請（`src/lib/join.ts`）

設定步驟（只要做一次）：

1. **LINE Official Account Manager**（<https://manager.line.biz/>）建立一個官方帳號（免費方案就夠：回覆訊息、查群組成員都不算訊息則數），
   再到「設定 → Messaging API」按「啟用」，Provider 選**跟 LINE Login 頻道同一個**
   - 一定要同一個 Provider：LINE 使用者 ID 是每個 Provider 各自一套，不同 Provider 會對不上
   - 啟用後到 **LINE Developers Console** 找到這個 Messaging API 頻道，「Messaging API」分頁：發一組 **Channel access token（long-lived）**；Webhook URL 填 `https://tietie-board.vercel.app/api/line-webhook`，打開 **Use webhook**，按 **Verify** 應該成功
   - 同一頁的 LINE Official Account features：**允許加入群組**（Allow bot to join group chats）打開，**自動回應訊息**、**加入好友的歡迎訊息**關掉
   - **Channel secret** 在「Basic settings」分頁
2. **Vercel 專案** → Environment Variables（Production）新增（都勾 Sensitive）：

   | 名稱 | 值 |
   |---|---|
   | `LINE_BOT_CHANNEL_SECRET` | Messaging API 頻道的 Channel secret（確認 Webhook 真的是 LINE 送來的） |
   | `LINE_BOT_ACCESS_TOKEN` | Messaging API 頻道的 Channel access token |

3. 上傳權限規則（`npm run deploy:rules`）**和**推到 `main` 要一起做：新規則不讓人自己把自己加成成員，舊版網頁 / App 會加入失敗
4. 把官方帳號邀進家庭群組，房主（用 LINE 登入的那個帳號）在群組裡貼一次邀請連結（或用「傳到 LINE 聊天室」），官方帳號回「✅ 綁定」就完成

注意：
- 房主要用手機版 LINE 貼連結：電腦版 LINE 的訊息有時候沒有發訊人的 LINE 使用者 ID，沒辦法確認是不是房主
- 匿名建立的公布欄，換成「別台裝置用過的 Google 帳號」時，房主身分不會跟著搬（換成 LINE 帳號會）；這時要用原本的身分處理申請
- App 要更新到這一版，舊版加入時會被新規則擋下

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

### 手機 App 的 LINE / Google 登入

App 裡沒有 LIFF（只能在 LINE 內建瀏覽器用），也開不了 Firebase 的 Google 彈出視窗，所以改用手機的瀏覽器登入（OAuth authorization code + PKCE）：

1. 按「用 LINE 登入」/「用 Google 登入」→ App 用系統瀏覽器打開 `https://tietie-board.vercel.app/api/oauth?provider=…`，它轉到 LINE / Google 的登入頁（`src/lib/oauth.ts`）
2. 登入完轉回 `/api/oauth?code=…`，這頁把 code 帶回 `tietieboard://oauth`；Chrome 沒自動跳回 App 時，頁面上有「回到貼貼公布欄」按鈕
3. App 把 code 和 PKCE 的 code_verifier 交給 `POST /api/oauth`，伺服器用 channel secret / client secret 換成 ID token（`api/oauth.ts`）
4. 之後跟網頁版一樣：LINE 的 ID token 交給 `/api/line-login` 換 Firebase 登入憑證；Google 的用 `linkWithCredential` 綁上目前的帳號
   - 匿名成員第一次登入沿用同一個 uid；這個 LINE / Google 帳號在別台裝置（或網頁版）用過，就換回那個身分

設定步驟（只要做一次，伺服器設定好就生效，不用重新建置 App）：

1. **LINE Developers Console** → LINE Login 頻道 → 「LINE Login」分頁 → **Callback URL** 加上 `https://tietie-board.vercel.app/api/oauth`
2. **Google Cloud Console**（Firebase 同一個專案）→ API 和服務 → 憑證 → OAuth 2.0 用戶端 ID 的
   「**Web client (auto created by Google Service)**」→ **已授權的重新導向 URI** 加上 `https://tietie-board.vercel.app/api/oauth`
   - 一定要用這個 client：Firebase 只認得它發的 Google ID token
3. **Vercel 專案** → Environment Variables（Production）新增（都勾 Sensitive），存好後重新部署一次：

   | 名稱 | 值 |
   |---|---|
   | `LINE_CHANNEL_SECRET` | LINE Login 頻道「Basic settings」分頁的 Channel secret（不是官方帳號那個） |
   | `GOOGLE_CLIENT_ID` | 上面那個 Web client 的用戶端 ID（`….apps.googleusercontent.com`） |
   | `GOOGLE_CLIENT_SECRET` | 同一個 Web client 的用戶端密鑰 |

注意：
- 沒設定好時，App 按登入會顯示「伺服器還沒設定好 LINE 登入 / Google 登入」
- 手機有登入 LINE App 時，LINE 的登入頁通常會自動登入（不用輸入帳號密碼）

## 裝到手機（PWA、Android App）

網頁版本身就能「加到主畫面」（PWA），不用另外設定：

- `public/manifest.json`：名稱、圖示、從主畫面打開時全螢幕；圖示在 `public/icons/`（從 `assets/images/icon.png` 縮出來的，換 App 圖示時一起換）
- `public/index.html`：網頁的 HTML 範本（`output: "single"` 時 Expo 會用它），連上 manifest、iPhone 主畫面圖示，
  並且一開始就接住 Chrome 的「可以安裝了」事件，使用者按「加到主畫面」時才跳出安裝視窗
- 不用 service worker（Chrome 已經不要求），也就沒有快取舊版網頁的問題

Android App（APK）的下載按鈕要設定下載網址才會出現，沒設定時 Android 只提供「加到主畫面」：

1. 建置 APK：`npx eas-cli@latest build -p android --profile preview`（`eas.json` 的 preview 設 `"android": { "buildType": "apk" }`），
   或本機 `cd android && ./gradlew assembleRelease`
2. 把 APK 放到固定的網址，建議用 GitHub Release（repo 是公開的）：發一個 Release，附檔名稱叫 `tietie-board.apk`，
   網址就固定是 `https://github.com/lincentHuang/TieTie-Board/releases/latest/download/tietie-board.apk`，之後發新版不用改設定
3. **Vercel 專案** → Environment Variables（Production）新增 `EXPO_PUBLIC_ANDROID_APK_URL` = 上面的網址，再重新部署

注意：
- iPhone 沒有 App 可以下載（沒有上架），只能加到主畫面；加到主畫面後跟 Safari 是分開的，第一次要重新登入（用 LINE 登入就會回到原本的公布欄）
- 加到主畫面的網頁版跟一般網頁版一樣收不到推播，要收通知請裝 Android App
- 在 LINE 裡按「用瀏覽器打開」：LIFF 裡用 `liff.openWindow({ external: true })`，一般 LINE 內建瀏覽器用網址參數 `openExternalBrowser=1`

### 從 LINE 直接打開 Android App（App Links）

`https://tietie-board.vercel.app/open?join=邀請碼` 登記成 Android App 的網址：

- `app.json` 的 `android.intentFilters`（`autoVerify`，只認 `/open` 開頭，LINE 登入回來的網址不會被 App 搶走）
- `public/.well-known/assetlinks.json`：Android 用它確認網站同意交給這個 App，裡面是 **EAS 簽 APK 用的憑證 SHA-256**。
  換了簽章金鑰（例如重設 EAS 憑證）要一起改，查法：`npx eas-cli@latest credentials -p android`
- App 收到這個網址時，`src/app/+native-intent.ts` 換成首頁 `/?join=邀請碼`；用瀏覽器打開時 `src/app/open.tsx` 轉回首頁

在 LINE 裡（Android、有設定 APK 下載網址時），設定的「裝到手機」會多一個「已經裝了 App？用 App 打開」，用 `liff.openWindow({ external: true })` 打開上面的網址：
LINE 15.20 以後有裝 App 就直接切過去，沒裝就用手機的瀏覽器打開。打開「以後點 LINE 裡的連結，直接用 App 打開」後（記在那支手機的 LINE 裡），
點邀請連結一進來就交給 App，LINE 裡只留一個「在 LINE 裡繼續」的畫面，不會再用 LINE 身分加入一次。

注意：
- 改了 `intentFilters` 要重新建置 APK、發新的 Release；家人要更新 App 才會生效
- App 裡沒登入（匿名）的話，跟 LINE 帳號是不同的人：App 裡還沒加入的公布欄，交給 App 後會送出加入申請，等房主同意；先在 App 的「設定 → 我的帳號」用 LINE 登入就不用等
- 驗證網站設定：`https://tietie-board.vercel.app/.well-known/assetlinks.json` 要打得開；裝好 App 後可以用
  `adb shell pm get-app-links com.huanglingcheng.tietieboard` 看 `tietie-board.vercel.app` 是不是 `verified`
- iPhone 加到主畫面的網頁沒辦法從連結打開（iOS 的限制）。在 LINE 裡加入後會提醒從主畫面打開；
  主畫面上的公布欄從背景切回來時，會把帳號上新加入的公布欄補進來（`session.tsx`），不用關掉重開

## 檔案結構

```
src/app/                  畫面路由（Expo Router），只負責決定顯示哪個畫面
src/features/board/       白板：Canvas（平移縮放）、CanvasItem（拖曳縮放）、編輯視窗、排隊模式…
src/features/setup/       加入公布欄：第一次使用（LINE / Google 登入或取暱稱、建立 / 加入群組）、邀請連結、切換 / 新增公布欄
src/features/widgets/     桌面小工具：BoardWidget.tsx（iOS，JSX → SwiftUI）、android/（Android）、資料轉換與同步、收到推播時背景更新
src/features/alerts/      快速通報：通報面板、App 裡的通報卡片、推播（送出、註冊推播代碼、點通知打開公布欄）
src/features/files/       附件：編輯時挑檔、附件清單、上傳下載、PDF 檢視器（pdf-viewer-html.ts，網頁版放 iframe、手機放 WebView）
src/features/pet/         公告小幫手：外觀（SVG）、捏寵物、提醒台詞、等級（尚未接到畫面上）
src/features/settings/    設定（右上角齒輪）、裝到手機：安裝提醒、依裝置教怎麼安裝（PWA / Android App）、在 LINE 裡改用 App 打開
src/components/           共用 UI：配色字型、按鈕、底部面板、頭像、對話框
src/lib/                  共用基礎：Firebase、資料存取（repo.ts）、型別、日期、錯誤訊息、提醒通知、登入（sign-in.ts、LINE：line.ts、liff.ts、App 用瀏覽器登入：oauth.ts）、加入公布欄（join.ts）、挑檔（documents.ts）、檔案快取與開檔（files.ts / files.native.ts）
api/line-login.ts         Vercel Function：驗證 LINE 登入，發 Firebase 登入憑證
api/oauth.ts              Vercel Function：手機 App 用系統瀏覽器登入 LINE / Google（轉到登入頁、帶 code 回 App、換 ID token）
api/join.ts               Vercel Function：LINE 群組成員點邀請連結時，確認後直接加入（免審核）
api/line-webhook.ts       Vercel Function：LINE 官方帳號的 Webhook，房主貼邀請連結時綁定群組
firestore.rules           資料庫權限規則
.github/workflows/        GitHub Actions：推到 main 時自動上傳權限規則（deploy-rules.yml）
public/                   網頁版的 HTML 範本、PWA 設定（manifest.json）與圖示、Android App Links 的 .well-known/assetlinks.json
```

依賴方向只能 `app → features → components → lib`，由 `eslint.config.js` 檢查（`npm run lint`）。
完整的架構規範在 `.claude/skills/expo-app-architect/SKILL.md`。

## 之後可以加

- iOS 即時動態（Live Activity）：緊急公告常駐在鎖定畫面 / 動態島
- 看板模式：舊平板放在冰箱上，全螢幕輪播公告
