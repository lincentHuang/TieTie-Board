# 📌 貼貼公布欄（TieTie Board）

家人、社團用的共享白板公布欄。iPhone、Android、網頁共用同一套程式（Expo）。

## 功能

- **自由白板**：像 Figma 一樣拖曳移動、拖四個角調整大小、雙指 / Ctrl＋滾輪縮放
- **便利貼、圖片、貼圖**：圖片會自動壓縮後存進 Firestore（不需要 Firebase 付費方案）
- **重要公告**：分「重要」「緊急」，每個人都要按「我知道了」；發文的人看得到誰還沒看
- **日期時間**：公告可以設活動時間，白板、小工具都會倒數，並在前一天、前一小時、準時發通知
- **桌面小工具**
  - iOS：小 / 中 / 大 / iPad 特大，加上鎖定畫面；時間到了會自動換下一件事
  - Android：可自由拉伸大小，每 30 分鐘自動更新
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
| 按「我知道了」 | 每個人只能幫自己按 |

規則在 `firestore.rules`。

## 本機開發（不需要 Firebase 帳號）

```bash
npm install
npm run emulators   # 終端機 1：啟動 Firebase 模擬器（需要 Java，會自動用 Android Studio 內建的）
npm run dev:web     # 終端機 2：開網頁版 http://localhost:8081
```

## 連接真正的 Firebase（給家人實際使用）

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

## 檔案結構

```
src/app/                 畫面路由（Expo Router）
src/components/board/    白板：Canvas（平移縮放）、CanvasItem（拖曳縮放）、編輯視窗…
src/lib/                 Firebase、資料存取、日期、小工具資料、提醒通知
src/pet/                 公告小幫手：外觀（SVG）、捏寵物、提醒台詞、等級
src/widgets/BoardWidget.tsx       iOS 小工具（expo-widgets，JSX → SwiftUI）
src/widgets/android/              Android 小工具（react-native-android-widget）
firestore.rules          資料庫權限規則
```

## 之後可以加

- 推播通知：有人發新公告時立刻通知大家（可用 Expo Push，不需要 Firebase 付費方案）
- iOS 即時動態（Live Activity）：緊急公告常駐在鎖定畫面 / 動態島
- 看板模式：舊平板放在冰箱上，全螢幕輪播公告
