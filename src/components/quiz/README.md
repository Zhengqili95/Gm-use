# 測驗元件（T-010，docs/CONTRACT.md B6）

課文裡放 `<Quiz id="lesson-1/quiz" />`，題目、選項和說明都來自 `src/lessons/lesson-1/quiz.yaml`。

| 檔案 | 內容 |
|---|---|
| `Quiz.astro` | 依 id 取測驗資料（`getEntry('quizzes', id)`，找不到就讓建置失敗），交給 `QuizApp`（`client:visible`，捲到才載入） |
| `QuizApp.tsx` | 畫面：全部題目一次列出，每個選項是一顆按鈕，點了就在那個選項下面顯示它的 `explain` |
| `quiz-logic.ts` | 答題規則和計分（打亂、`applyPick`、`scoreOf`），不碰畫面，`quiz-logic.test.mjs` 用 Node 直接測 |
| `quiz.css` | 樣式，只用 Starlight 的顏色變數，深色和淺色模式自動跟著變 |

## 怎麼運作

- **點選項**：立刻看到那個選項的說明，選項上有 ✓（正確）或 ✗（不是這個），不只靠顏色。答錯可以再選別的選項；每個點過的選項的說明都留在畫面上，方便比較。
- **計分**：第一次就點對才得 1 分，畫面最下面顯示「第一次就答對 X／N 題」。每一題最後都答對，測驗就完成。答對之後再點別的選項只是看說明，不改計分。
- **選項順序**：每次載入時打亂。進度裡用「選項在檔案裡的原始位置」記錄（`picked`），所以重新整理、重新打亂之後，哪些選項點過、對錯，都還是對得上。
- **進度**：存進 `src/lib/progress-store.ts` 的 `updateQuiz`（`QuizAnswer`：`firstTryCorrect`、`tries`、`done`、`picked`）。畫面的狀態全部從儲存的進度算出來，所以別的分頁改了進度，這裡也會跟著變。
  - `tries`：答對之前點過幾個不同的選項（含答對的那一次）。重複點同一個選項不另外算。
  - 題目改過、`picked` 的位置超出選項範圍時，那個位置會被忽略。
- **水合**：伺服器端渲染出來的網頁只有題目，選項寫「選項載入中…」；等元件啟動之後才打亂選項、才讀進度，所以第一次畫出來的樣子和伺服器端一樣，也不會閃一下「照檔案順序排好的選項」。
- **給「問 AI」的上下文（B8）**：題目和程式碼會進 `getContext().text`；選項是 `<button>`，不進文字；說明和分數標了 `data-no-context`；給螢幕閱讀器的 `sr-only` 文字也不進。
- **螢幕閱讀器**：選項點下去之後，說明會從一個隱藏的 `aria-live` 區塊念出來；點過的選項後面有「（正確答案）」「（不是正確答案）」。

## 已知限制

- 答案（`correct`）和說明在 island 的 props 裡，開啟網頁原始碼看得到，和練習的標準答案一樣；這不是防作弊的設計，只是讓畫面上的文字（以及給 AI 的上下文）不含答案。
- 沒有「重做測驗」的按鈕（約定 B6 沒有寫）。要重做只能清掉瀏覽器的網站資料。試讀時如果有人需要，再加。

## 測試

```
npm test                                                              # 含 quiz-logic.test.mjs、progress-store.test.mjs、sidebar-progress.test.mjs
node src/components/quiz/browser-smoke.mjs http://localhost:4321/Gm-use/ [課號]   # 真瀏覽器驗收，要先開網站
```

`browser-smoke.mjs` 不在 `npm test` 裡（要有執行中的網站和瀏覽器；Windows 用 Edge，其他系統用 Chrome，和 `test:exercises` 一樣）。它從 `src/lessons/lesson-N/` 的 YAML 讀題目和練習的標準答案，所以課文內容改了不用改它：

- 測驗：選項數、打亂、先錯後對不得分、第一次就對得分、答對後再點別的選項不改計分、重新整理後進度還在
- 練習加進度：把標準答案打進編輯區，最後一個過關之後側邊欄才變成「1 / N 課」並打勾；側邊欄裡每個課程頁都一樣；另一個分頁清掉進度時跟著變回 0
- 直接把進度寫進 localStorage：看過答案之後過關（`revealed`）也算完成、差一個練習或一題測驗不算、進度資料被改壞時不出錯、手機選單裡看得到進度
- 手機寬度（320、375）頁面不會橫向捲動；整個過程沒有 console error

只支援 preview 類型的練習；課文有 api、sql 練習時，「一課完成」那幾步會略過。在 dev server（第 1～3 課都在側邊欄）和 `npm run build` 加 `npm run preview`（只有已上線的課）上都跑過。
