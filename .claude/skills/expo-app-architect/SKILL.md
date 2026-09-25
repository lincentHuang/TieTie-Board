---
name: expo-app-architect
description: 公布欄 App（Expo Router + React Native + Firebase）的前端架構規範：路由層要薄、功能模組分層、Firestore 資料存取層（repo）、權限規則、狀態管理層級、跨平台檔案與效能守則。只要在這個專案新增功能、寫新畫面或元件、改資料存取或 Firestore 結構、重構前端程式碼、審查前端架構時就要先載入。Use for any feature work, new screen/component, data-access change, refactor, or architecture review in this Expo app.
---

# 角色：資深 Expo / React Native 架構師

這個專案是 **Expo Router + React Native（iOS / Android / 網頁共用一套程式）**，後端是 **Firebase（匿名登入 + Firestore，直接由 App 端連線）**。沒有自己的伺服器、沒有 React Server Components、沒有 Server Actions。
以下規範把「薄路由、領域分層、零洩漏、型別安全」的原則，套用在這個專案實際的架構上。

寫任何 Expo / React Native API 之前，照 `AGENTS.md` 先查對應版本（`package.json` 的 `expo` 主版本）的官方文件，不要憑記憶。

## 1. 目錄與分層邊界

```
src/
  app/            路由層：只做編排（每個檔案都是一個路由）
  features/       功能模組：每個功能一個資料夾
    board/        白板（主畫面）：畫布、項目、編輯、排隊、公告面板…
    setup/        第一次使用：取暱稱、建立 / 加入群組
    widgets/      桌面小工具：iOS（BoardWidget）、Android（android/）、資料轉換與同步
    pet/          公告小幫手（寵物）——元件已完成，尚未接到畫面上
  components/     共用 UI：ui.tsx（C、F、Button…）、Sheet、MemberAvatar、dialogs
  lib/            共用基礎：firebase、repo（資料存取）、types、session、dates、errors、提醒通知
```

**依賴方向只能往下**：`app → features → components → lib`。反過來就是違規：

| 資料夾 | 可以 import | 不可以 import |
|---|---|---|
| `src/app/` | features、components、lib | — |
| `src/features/board/` | 其他 features 對外的函式與元件、components、lib | `firebase/*` |
| `src/features/`（board 以外） | components、lib | `@/features/board/*`、`firebase/*` |
| `src/components/` | lib | `@/features/*`、`firebase/*` |
| `src/lib/` | lib 自己 | `@/features/*`、`@/components/*`；`firebase/*` 只限 `repo.ts`、`firebase*.ts` |

這些規則寫在 `eslint.config.js` 的 `no-restricted-imports`，`npx expo lint` 會直接擋下來；不要為了過 lint 去關掉規則。

- **路由層（`src/app/`）**：只做編排。負責讀路由參數、依登入 / 群組狀態決定顯示哪個畫面、組合功能元件、載入中與錯誤畫面。
  - 不在這裡直接呼叫 Firestore、不放大段 UI、不放商業邏輯。範例：`src/app/index.tsx` 只依 `useSession()` 切換 `BoardScreen` / `SetupScreen`。
  - 元件、hooks、工具函式一律放在 `src/app/` 以外。
  - 路由檔要做平台專屬版本（`x.web.tsx`、`x.ios.tsx`）時，一定要同時有沒有副檔名的 `x.tsx`（深層連結需要）。
- **功能模組（`src/features/<功能>/`）**：該功能的畫面元件、hooks（`useBoard.ts`、`useViewPrefs.ts`）、純函式都放在自己的資料夾。
  - 新功能一律開新的 `src/features/<功能>/`，不要塞進 `src/components/`。
  - 純邏輯（排序、篩選、版面計算）抽成 `.ts` 檔，例如 `queue-filter.ts`、`queue-layout.ts`，不要寫在元件裡；純邏輯檔不能 import 元件檔（共用型別放 `src/lib/types.ts`，例如 `Geometry`）。
  - 同一個功能內用相對路徑（`./Canvas`）；跨資料夾一律用別名（`@/components/ui`、`@/lib/repo`）。
- **共用 UI（`src/components/`）**：只放兩個以上功能會用到、跟資料無關的元件與 UI 工具。
  - 顏色、字型一律用 `ui.tsx` 的 `C`、`F`，不要在元件裡寫死新的色碼。
  - 確認對話框、錯誤提示用 `dialogs.ts` 的 `askConfirm`、`showError`（網頁版的 `Alert.alert` 什麼都不會顯示，不要直接用）。
- **共用基礎（`src/lib/`）**：跨功能、跟畫面無關的東西。
  - `repo.ts`：Firestore 資料存取層（唯一可以讀寫 Firestore 的地方）。
  - `types.ts`：領域型別、合法值清單（`ITEM_TYPES`、`PRIORITIES`、`STATUSES`）與跟型別綁在一起的純函式（`isAckedBy`、`byUrgency`…）。
  - `firebase.ts`、`session.tsx`：連線初始化與登入狀態；`errors.ts`：把錯誤轉成中文訊息。
- **import 分組**：套件 → 空一行 → `@/...` 別名（依路徑排序）→ 空一行 → 相對路徑。

## 2. 元件拆分與「邊界」規則

這個專案沒有伺服器元件，對應 Next.js 規則的是下面三條邊界：

- **狀態往葉子推**：互動狀態放在真正需要它的最小元件裡，不要讓 `BoardScreen` 這種大容器為了一個輸入框整個重新渲染。拖曳、縮放等每一格都在變的值用 Reanimated 的 shared value（`useSharedValue`）在 UI 執行緒處理，手勢結束時才用 `scheduleOnRN` 回到 JS、再寫回 Firestore（參考 `CanvasItem.tsx`）。
- **用 children 組合**：外殼元件（`Sheet`、未來的折疊面板、對話框）只管開關狀態，內容用 `children` / `footer` 傳進來，外殼不要 import 內容元件。
- **平台邊界（取代 `server-only`）**：只存在原生端的模組（`expo-widgets`、`react-native-android-widget`、`expo-notifications` 等）只能在平台專屬檔案裡 import：
  - 寫 `x.native.ts` / `x.ios.ts` / `x.android.ts`，並保留沒有副檔名的 `x.ts` 當網頁版替身（空實作），讓型別檢查與網頁版都能解析。範例：`features/widgets/widget-sync.ts` / `.ios.ts` / `.android.ts`、`lib/reminders.ts` / `.native.ts`、`components/dialogs.ts` / `.native.ts`。
  - 各平台版本的匯出名稱與函式簽名必須完全相同。
  - 共用檔案永遠 import 沒有副檔名的路徑（`@/features/widgets/widget-sync`），交給 Metro 挑平台版本。
- **機密邊界**：`EXPO_PUBLIC_` 開頭的環境變數會在建置時直接寫進 App，任何人都看得到。Firebase 網頁設定值可以放，其他金鑰、密碼、管理者憑證**絕對不能**放進 App。

## 3. 資料存取層（repo）與寫入

- **所有讀寫都經過 `src/lib/repo.ts`**。元件與 hooks 不直接 import `firebase/firestore`、不自己組 `doc()` / `collection()` 路徑。
- **讀取（即時訂閱）**：
  - 寫成 `watchX(gid, cb)`，回傳取消訂閱函式；在 hook 的 `useEffect` 裡訂閱、cleanup 時取消（參考 `useBoard.ts`）。
  - 一定要經過 `toX(id, data)` 轉換：參數型別用 `Record<string, unknown>`（不要用 `DocumentData`，它是 `any`），每個欄位都用 `num` / `str` / `oneOf` 等小工具檢查型別、補預設值。不要把原始資料丟給 UI。
  - `Timestamp` 在 repo 裡轉成毫秒（`number | null`），UI 不處理 Firestore 型別。
- **寫入（取代 Server Actions）**：
  - 依「誰可以改什麼」拆成不同函式，用 `Pick<>` 限制可以改的欄位，例如 `moveItem`（位置，所有成員）、`organizeItem`（狀態 / 標籤，所有成員）、`editItem`（內容，只有作者）。
  - 寫入前經過 `toFirestore` 之類的轉換：去掉 `undefined`（Firestore 不接受）、去掉唯讀欄位（`id`、`createdAt`、`ackBy`）、時間用 `serverTimestamp()`。
  - 預期中的失敗（例如邀請碼不存在）回傳 `false` / `null` 讓畫面處理；非預期錯誤直接丟出。
  - 使用者按下去的動作（新增、刪除、確認、移動…）一定要 `catch`，用 `showError('刪除失敗', e)` 提示；畫面上的表單則用 `errorMessage(e)` 顯示在欄位下方。不要留下沒接住的 Promise。
  - 失敗時保留使用者的輸入（例如編輯視窗不要關掉）。背景同步類的錯誤（小工具、提醒通知）用 `console.warn` 記錄即可。
- **權限以 `firestore.rules` 為準（取代「寫入前驗證 session」）**：
  - 畫面上隱藏按鈕只是體驗，真正的防線是規則。新增任何寫入路徑或欄位，**同一個改動裡**就要更新 `firestore.rules`（誰能寫、能改哪些欄位、格式與長度限制）。
  - 用模擬器驗證：`npm run emulators` + `npm run dev:web`。
- **輸入驗證**：表單值先在 UI 正規化（例如 `normalizeTag`），寫入時由 `toFirestore` 與規則再把關。專案目前沒有安裝 zod；不要自行加入，除非使用者同意（要加的話用 `npx expo install zod`）。
- **不用手動重新抓資料**：`onSnapshot` 會自動推送最新資料，寫入後不要再手動 refetch 或維護第二份副本。
- **資料量**：圖片先壓縮（`src/lib/images.ts`，最長邊 900px、JPEG）再存；Firestore 單一文件上限 1MB，新增大欄位前先估算大小。

## 4. 狀態管理層級

由上往下選，能用上層就不要往下：

1. **遠端狀態**：Firestore 即時訂閱，透過功能 hook（`useBoard`）提供。它是唯一真實來源，不要複製進其他 state 再手動同步。用 `null` 代表「還在載入」、`[]` 代表「沒有資料」，兩者畫面要分開處理。
2. **網址狀態**：需要能分享、能用深層連結（`bulletinboard://`）打開、或網頁重新整理後要保留的狀態（例如篩選、目前開啟的項目），用 Expo Router 的參數：
   - 讀：`useLocalSearchParams<{ tab?: string }>()`（不要用 `useGlobalSearchParams`，會讓背景畫面多餘地重新渲染）。
   - 寫：`router.setParams({ tab })`（不會新增一層導覽紀錄）。
   - 參數名稱避開保留字 `screen`、`params`、`initial`、`state`；讀到的值一律當作不可信的字串，先驗證再用。
3. **區域 UI 狀態**：`useState` / `useReducer`。能從其他值算出來的就在渲染時直接算，不要另存 state。專案開了 **React Compiler**，不要手動加 `useMemo` / `useCallback` / `React.memo`，除非量測到效能問題。
4. **全域 App 狀態**：React Context（例如 `SessionProvider`）。需要保存到下次開 App 的偏好設定用 AsyncStorage。不要引入 Zustand、Jotai 等套件，除非 Context 已經明顯不夠用且使用者同意。

## 5. 效能與開發體驗

- **平行處理**：互不相依的非同步工作用 `Promise.all`（參考 `session.tsx` 同時讀登入狀態與 AsyncStorage）。
- **載入狀態**：資料還沒到時顯示 `ActivityIndicator` 或骨架畫面，不要讓畫面閃一下空狀態。
- **動畫與手勢**：用 Reanimated + Gesture Handler，動畫值留在 UI 執行緒；每一格都 `setState` 會讓白板卡頓。尊重 `useReducedMotion()`。
- **長列表**：項目多或會持續成長的清單用 `FlatList`，不要用 `ScrollView` 加 `.map()`。
- **圖片**：顯示用 `expo-image`，存檔前先壓縮。
- **不要做 barrel 檔**：不要新增只為了重新匯出的 `index.ts`；直接從目標模組 import（`@/lib/repo`、`@/components/board/Canvas`）。
- **環境變數**：只用 `EXPO_PUBLIC_` 開頭的變數，且必須寫成 `process.env.EXPO_PUBLIC_XXX`（點記號、靜態寫死），不能解構或用 `process.env[key]`，否則不會被替換。缺少必要設定時要有明確的中文錯誤提示（參考 `firebaseConfigured`）。
- **新增套件**：一律 `npx expo install <套件>`；有原生程式的套件要重新做 development build，Expo Go 跑不起來。

## 產生或重構程式碼的流程

1. 先判斷屬於哪個功能，放進對應資料夾（第 1 節）；路由檔只做編排。
2. 先定型別：在 `src/lib/types.ts`（跨功能）或功能資料夾內新增 / 修改型別。
3. 再做資料層：`repo.ts` 的 `watchX` / `toX` / 寫入函式，**同時**更新 `firestore.rules`。
4. 再做 hook（訂閱、衍生資料），最後才是畫面元件；純邏輯抽成 `.ts` 純函式。
5. 用到原生專屬模組時，照第 2 節拆平台檔案並保留網頁版替身。
6. 型別嚴格、**不准用 `any`**：外部資料先當 `unknown`，再用型別守衛收窄。
7. 畫面文字用繁體中文（台灣用語），註解風格比照現有程式（簡短的中文 `/** */` 說明「為什麼」）。
8. 完成前一定要跑：

   ```bash
   npx expo lint
   npx tsc --noEmit
   ```

   牽涉資料或權限的改動，再用模擬器 + 網頁版實際操作驗證。
