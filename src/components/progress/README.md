# 學習進度元件（T-010，docs/CONTRACT.md B7）

更新側邊欄上方的「學習進度」（接口寫在 `src/components/layout/README.md`）：「已完成課數 / 總課數」、進度條，和完成的課程連結上的 ✓。

| 檔案 | 內容 |
|---|---|
| `SidebarProgress.astro` | 放在 `src/components/layout/Sidebar.astro` 裡，每一頁的側邊欄都有，課文不用放。它在建置時把每一課要做完的東西寫進頁面（`<script type="application/json" id="vl-lesson-manifest">`：每個練習的 id、測驗每一題的 id），再載入 `sidebar-progress.ts` |
| `sidebar-progress.ts` | 在瀏覽器裡執行：讀進度，更新 `[data-vl-progress-count]`、`[data-vl-progress-fill]`，在完成的課程連結（`nav.sidebar a`）加 `data-vl-done="true"`；進度有改動時（`vibe:progress` 事件，包含別的分頁改的）重畫 |
| `sidebar-progress.test.mjs` | 課號從網址取出、哪幾課完成、清單的格式檢查，用 Node 直接測 |

「一課完成」的判斷在 `src/lib/progress-store.ts` 的 `isLessonDone`：課文 frontmatter `exercises` 裡每個練習都是 `passed` 或 `revealed`，而且測驗每一題都答對（`done`）。沒有練習或沒有測驗題目的課（佔位頁）不算完成。完成是從目前的課文和進度算出來的，不是存起來的旗標：課文後來多了一題，已經完成的課會變回沒完成。

總課數用 `[data-vl-progress]` 的 `data-vl-total`（`Sidebar.astro` 從側邊欄「課程」群組的連結數算出來，已經不含草稿）；從網址 `/lessons/lesson-N/` 取出 `N` 對應到 `lesson-N`。

## 新增一課時

課文不用放 `<SidebarProgress />`：它已經在 `src/components/layout/Sidebar.astro` 裡（M-090），清單會自動算進新的課。課文裡再放一次的話，頁面上會有兩份清單。

要算得出這一課完成，課文 frontmatter 要有 `exercises` 和 `quiz`（見上面「一課完成」）。

## 驗證過的情況

單元測試（`npm test`）：課號從網址取出、哪幾課完成、清單被改壞時的處理、`isLessonDone` 的各種情況。

真瀏覽器（Edge）：`node src/components/quiz/browser-smoke.mjs <網站根網址> [課號]`（說明見 `src/components/quiz/README.md`）：做完整的「練習加測驗 → 側邊欄變成完成 → 側邊欄裡每個課程頁都一樣 → 另一個分頁清掉進度時跟著變回 0」；另外直接把進度寫進 localStorage，確認看過答案之後過關（`revealed`）也算完成、差一個練習或一題測驗不算、進度資料被改壞時不出錯、手機寬度打開選單看得到進度。
