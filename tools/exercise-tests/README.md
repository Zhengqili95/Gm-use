# 練習自我測試（`npm run test:exercises`，T-009b）

用真的瀏覽器和練習元件真正在用的檢查執行器，把每個練習跑兩次（`docs/CONTRACT.md` B9）：

- **標準答案**（`{ ...files, ...solution }`，和畫面的「套用答案」一樣）要通過全部檢查。
- **起始內容**（`files`）要至少一條檢查沒過，不然學習者不用改就過關。

merge 前在本機執行。因為要開瀏覽器，所以不在 `npm test` 和部署流程裡。

## 用法

```
npm run test:exercises                    # 全部練習
npm run test:exercises -- lesson-1        # 只跑第 1 課
npm run test:exercises -- lesson-1/ex-2   # 只跑一題
```

每個練習印一行（✓ 正常、✗ 有問題、－ 略過），最後印總數；有任何一個 ✗ 就回傳 1。

```
✓ lesson-0/ex-1  標準答案全過；起始內容沒過：title-text
✗ lesson-1/ex-2  標準答案沒過：after-click（執行逾時）
－ lesson-2/ex-1  略過：api 練習還不支援（等 T-014 的模擬伺服器）

通過 1 個、沒過 1 個、略過 1 個（略過的不算通過）
```

| 印出來的 | 意思 |
|---|---|
| `標準答案沒過：檢查 id` | 標準答案有檢查沒通過；後面可能附「執行逾時」或「程式錯誤：…」 |
| `起始內容就通過全部檢查…` | 檢查寫得太鬆，或起始內容已經是答案 |
| `起始內容執行逾時` | 起始內容本身卡住了（例如無窮迴圈）；照樣算沒過，但確認一下是不是故意的 |
| `格式不對：…` | 缺了跑檢查需要的欄位；完整的格式檢查是 `npm run check:content` |
| `檢查卡住了：…` | 一次檢查超過 30 秒沒有結果 |
| `略過：…` | api（等 T-014）、sql（等 T-015a）還不支援，不算通過 |

## 瀏覽器

Windows 用內建的 Edge（`msedge`），其他系統用 Google Chrome（`chrome`），都不用另外下載瀏覽器。要換的話設定環境變數 `EXERCISE_TEST_BROWSER`：`msedge`、`chrome`，或 `chromium`（要先執行 `npx playwright install chromium`）。

## 怎麼運作

| 檔案 | 內容 |
|---|---|
| `browser-entry.js` | 在瀏覽器裡執行：呼叫 `src/components/exercises/runner/run-checks.ts` 的 `runChecks` |
| `bundle.mjs` | 用 Vite（Astro 帶進來的，不用另外安裝）把上面那個檔案打包成一段程式。`run-case.ts` 用 `?raw` 匯入 `iframe-runner.js`，只有 Vite 看得懂，所以不能直接用 Node 執行 |
| `browser.mjs` | 用 Playwright 開一個看不見的瀏覽器，在空白頁載入打包好的程式，再呼叫它跑檢查 |
| `lib.mjs` | 找練習檔、檢查基本格式、判斷結果、組出要印的文字。不碰瀏覽器，`lib.test.mjs` 跟著 `npm test` 跑 |
| `run.mjs` | 指令本身 |

**無窮迴圈**：檢查執行器每個 case 3 秒逾時，逾時後會拿掉那個 iframe，但跑那個 iframe 的程序不會停下來（實測一直佔著 CPU），在 Windows 上還會讓 Playwright 的 `close()` 一直等下去。所以只要有檢查逾時，就把整個瀏覽器的程序樹直接結束、再重開一個；測試結束時也是直接結束，不用 `close()`。

## 自我檢查

`fixtures/` 裡是故意寫錯的練習：標準答案沒改到、按下去就無窮迴圈、一打開就無窮迴圈、不用改就過關、少了欄位、YAML 寫錯、api、sql，還有排序用的 `lesson-10`。用來確認這個工具抓得到問題、不會卡住：

```
node --test tools/exercise-tests/self-check.mjs
```

改了這個資料夾的程式，或是改了檢查執行器（`src/components/exercises/runner/`）之後，跑一次。
