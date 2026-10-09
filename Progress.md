# Progress
- 2026-10-07：便利貼內容可以自己指定標題、重點字、連結（編輯器加三顆按鈕＋預覽；卡片、檢視畫面、公告、附件都會照格式顯示，小工具與通知用標題）（src/lib/rich-text.ts、src/components/RichText.tsx、src/features/board/ItemEditor.tsx）
- 2026-10-08：header 的行事曆按鈕改成真的月曆，點某天只列出當天的公告與行程；原本的公告／行程橫幅壓成 header 第二行的小膠囊（src/features/board/CalendarSheet.tsx、calendar.ts、BoardScreen.tsx）
- 2026-10-08：加速網頁版啟動：開啟時先用上次的登入狀態直接顯示公布欄、登入確認改背景；網頁不等 4.7MB 字型（改 Google Fonts 分片）；HTML 內建開場畫面與預先連線；Firestore 網頁持久快取；Vercel 靜態檔長期快取（src/lib/session.tsx、src/lib/fonts*.ts、src/lib/firebase-cache*.ts、public/index.html、vercel.json）
- 2026-10-08：白板碰撞改成看速度：拖得快（每秒 700px 以上）才把別張撞開；慢慢拖就踮起腳、腳伸長、冒汗小心跨過去，被跨的那張縮一下讓路，跨到一半加速也不會撞飛（src/features/board/CanvasItem.tsx、Canvas.tsx）
- 2026-10-08：便利貼可以加入待辦清單（工具列新增「待辦」、編輯器一格一項按 Enter 接下一項）；白板卡片顯示清單與進度、全部勾完蓋「完成」章；點兩下打開可打勾、顯示誰勾的；header 第二行（通知列）加待辦小膠囊，圈圈直接打勾，點開是全部待辦的面板（含狀態是待辦的便利貼）；Firestore 規則讓成員可以打勾、不能改清單內容（src/features/board/todos.ts、Checklist.tsx、ChecklistEditor.tsx、TodoPill.tsx、TodoSheet.tsx、src/lib/repo.ts、firestore.rules）
- 2026-10-08：修正手機瀏覽器快速點兩下卡片打不開檢視視窗：不再用手勢套件的 numberOfTaps(2)，改在單擊手勢裡自己算（400ms 內、40px 內算點兩下）；點一下選取也不用再等半秒（src/features/board/CanvasItem.tsx）
- 2026-10-08：修好編輯別人便利貼時「沒有權限」：GitHub Action 缺 FIREBASE_SERVICE_ACCOUNT，新規則沒上傳，改從本機手動部署 firestore.rules
- 2026-10-09：新增「滑動」看板模式並設為預設：像網頁一樣卡片同寬排成一欄上下捲，依日期分段（今天／明天／某天→沒有日期→已經過了），最下面有「新增公告」；模式按鈕改成滑動／自由／排隊三顆。新公告日期欄移到內容下面第二行、預設今天；內容裡寫的日期時間（明天、下週三、10/12、晚上七點半…）會自動帶入日期欄（src/features/board/SwipeBoard.tsx、swipe-order.ts、ModeBar.tsx、parse-when.ts、ItemEditor.tsx、BoardScreen.tsx、useViewPrefs.ts）
- 2026-10-09：便利貼可以有開始與結束時間（新增 endAt 欄位；編輯器「開始」下面多一個「結束（選填）」、改開始時結束一起挪；卡片、檢視顯示「10/14（三）09:00 ～ 10/16（五）18:00」或「今天 14:00–16:00」，結束前都算進行中；月曆上跨天的每天都列；滑動模式進行中的排在今天）。自動認日期改成編輯時也會套用（內容裡的日期沒變就不動原本設好的），並認得範圍「10/14~10/16」「下午2點到4點」「週三至週五」「晚上10點到1點」（src/lib/types.ts、repo.ts、dates.ts、firestore.rules、src/features/board/parse-when.ts、ItemEditor.tsx、ItemBody.tsx、ItemViewer.tsx、calendar.ts、CalendarSheet.tsx、swipe-order.ts）
