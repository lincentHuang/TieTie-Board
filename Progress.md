# Progress
- 2026-10-07：便利貼內容可以自己指定標題、重點字、連結（編輯器加三顆按鈕＋預覽；卡片、檢視畫面、公告、附件都會照格式顯示，小工具與通知用標題）（src/lib/rich-text.ts、src/components/RichText.tsx、src/features/board/ItemEditor.tsx）
- 2026-10-08：header 的行事曆按鈕改成真的月曆，點某天只列出當天的公告與行程；原本的公告／行程橫幅壓成 header 第二行的小膠囊（src/features/board/CalendarSheet.tsx、calendar.ts、BoardScreen.tsx）
- 2026-10-08：加速網頁版啟動：開啟時先用上次的登入狀態直接顯示公布欄、登入確認改背景；網頁不等 4.7MB 字型（改 Google Fonts 分片）；HTML 內建開場畫面與預先連線；Firestore 網頁持久快取；Vercel 靜態檔長期快取（src/lib/session.tsx、src/lib/fonts*.ts、src/lib/firebase-cache*.ts、public/index.html、vercel.json）
- 2026-10-08：白板碰撞改成看速度：拖得快（每秒 700px 以上）才把別張撞開；慢慢拖就踮起腳、腳伸長、冒汗小心跨過去，被跨的那張縮一下讓路，跨到一半加速也不會撞飛（src/features/board/CanvasItem.tsx、Canvas.tsx）
- 2026-10-08：便利貼可以加入待辦清單（工具列新增「待辦」、編輯器一格一項按 Enter 接下一項）；白板卡片顯示清單與進度、全部勾完蓋「完成」章；點兩下打開可打勾、顯示誰勾的；header 第二行（通知列）加待辦小膠囊，圈圈直接打勾，點開是全部待辦的面板（含狀態是待辦的便利貼）；Firestore 規則讓成員可以打勾、不能改清單內容（src/features/board/todos.ts、Checklist.tsx、ChecklistEditor.tsx、TodoPill.tsx、TodoSheet.tsx、src/lib/repo.ts、firestore.rules）
