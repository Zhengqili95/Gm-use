# Learning feedback effects (T-020)

獨立的效果工具，不讀寫答案、練習狀態或進度。T-020b 由 Claude-A 接入課程（見最後「接進課程的地方」）；數值照使用者的 D-025 加強過（彈得更大、光暈更久、測驗選項跟著滑鼠傾斜、完成一課放彩帶）。

## 使用

載入一次 `fx.css`，再從 `fx.ts` 匯入 `play`、`celebrate`。模組匯入時不操作 DOM，可由 Astro 處理；函式在瀏覽器的互動事件中呼叫。

```ts
import './fx.css';
import { play, celebrate } from './fx';

play(checkRow, 'pop');
celebrate(checkRow, 'pass');
```

| 效果 | 樣子／用途 | 時間 |
|---|---|---|
| `pop` | 從 0.7 倍彈過頭到 1.12 倍，再回到原尺寸；過關的結果、選對的 ✓、完成課程的 ✓ | 360ms |
| `shake` | 左右 5px 晃兩下再停；沒過的結果、選錯的測驗選項 | 320ms |
| `glow` | 2px 品牌綠外框加半透明光暈，亮起再退去；過關的練習、全部答對的測驗總結 | 1400ms |
| `slide-in` | 從上方 8px 淡入定位；新的提示、說明、標準答案 | 240ms |

數值改過時，`fx.css` 和 `fx.ts` 的 `durations` 要一起改（`durations` 是 `play()` 備援計時器的長度）。

四種效果也可直接加 `vl-fx-<effect>` class 播一次。使用 `play(el, effect)` 會在結束時清除 class，快速連按從頭播；同一元素一次只播放一種效果，換效果會清除前一個。null、已移除的元素不做事。動畫中途被移除／外部 CSS 停止時，備援計時器最晚在該效果時間加 80ms 清理監聽。目標應使用 block 或 inline-block；對已經有 CSS animation 的元素，建議套在額外的內層元素，避免搶用 animation 屬性。scale／translate 使用獨立屬性，不覆蓋 transform。

## 可選的慶祝

`celebrate(el, 'pass' | 'lesson', { force?: boolean })` 從元素中心噴出 18 顆星星或 64 片彩帶（低於 20／80 上限），1.2 秒內結束。全模組同時至多一張 canvas，新的一次會取代前一次；canvas 不擋點擊且從無障礙樹隱藏。顏色讀取目標的 `--sl-color-accent`、`--sl-color-accent-high`、`--sl-color-white`，支援深／淺主題。粒子持續淡出，不做閃爍或快速明暗切換。

`fx.ts` 匯出的 `FX_PARTICLES` 定義在 `fx-logic.ts`，T-020 時預設 false；使用者看過示範頁後決定打開（D-025），現在是 **true**。課程裡只在完成一課時呼叫 `celebrate(…, 'lesson')`（`src/components/progress/sidebar-progress.ts`），練習過關不噴星星。一般課程呼叫不要傳 force；`force: true` 只供示範頁預覽。切換分頁、離開頁面、改變視窗尺寸、移除目標都會提前停止並移除 canvas。

## 跟著滑鼠傾斜（D-025）

元素加上 `vl-fx-tilt` class，在 `pointermove` 呼叫 `tilt(el, event)`、`pointerleave` 呼叫 `untilt(el)`：滑鼠在元素上移動時，最多傾斜 3 度（中間是 0 度，邊緣是 ±3 度），離開時回正。只有滑鼠（`pointerType === 'mouse'`）而且裝置是 `(hover: hover) and (pointer: fine)` 時才做；觸控、筆和減少動態時不做。傾斜用 `transform`，元素自己的 `transition` 要包含 `transform`，回正時才會慢慢回去。角度的算法是 `fx-logic.ts` 的 `tiltAngles`。

## 減少動態

`prefers-reduced-motion: reduce` 優先於所有開關，包含 force。四種 CSS 動畫完全停播，元素直接呈現原本的最終狀態；JavaScript 不新增動畫或 canvas。播放途中改為減少動態也會立即清理。效果不承擔成功／失敗的語意，呼叫端仍應提供清楚文字與無障礙狀態通知。

## 驗證與示範

- `node --test src/components/fx/fx.test.mjs`：播放政策、粒子上限／起點、可重現的亂數。也包含於 `npm test`。
- 開發頁 `/Gm-use/dev/fx/`：每個效果有按鈕，還有 force 星星／彩帶。`draft: true`，正式建置不產生此頁。
- 啟動獨立 dev server 後執行 `node src/components/fx/browser-check.mjs http://127.0.0.1:4347/Gm-use/dev/fx/` 可重現 Edge 驗收；使用既有 Playwright，不裝瀏覽器。截圖在系統暫存目錄的 `vibe-t020-evidence/`，沒有模型呼叫。
- 驗收需涵蓋連按重播、播放完 class／canvas 清除、深色／淺色、375px、減少動態（包含播放中切換），以及 `npm test`、`npm run check`、`npm run check:content`、`npm run build`。
- 體積以正式 Vite 打包、逐個外部 JS gzip（B10）計算；核心含 `fx-logic.ts`，不計僅供開發的示範頁程式。T-020b 整合後仍需再量完整課程頁，不能直接把核心大小當成整頁結果。

## 接進課程的地方（T-020b，D-024、D-025）

- `astro.config.mjs`：`fx.css` 放進 Starlight 的 `customCss`，每一頁都載入。
- 練習（`src/components/exercises/ExerciseApp.tsx`）：過關時整個練習框 `glow`、結果 `pop`；沒過或逾時時結果 `shake`；按「給我提示」新的那一層 `slide-in`；打開標準答案 `slide-in`。還原進度時不播。按鈕的抬起、下壓寫在 `exercise.css`。
- 測驗（`src/components/quiz/QuizApp.tsx`）：選對時 ✓ `pop`、選錯時選項 `shake`；這次才出現的說明 `slide-in`；全部答對的那一刻總結框 `glow`（打開頁面時已經答完的不播）；選項跟著滑鼠傾斜。按鈕的抬起、下壓寫在 `quiz.css`。
- 側邊欄（`src/components/progress/sidebar-progress.ts`）：在這一頁看著完成的課，連結加上 `vl-just-done`，✓ 彈一下（樣式在 `src/styles/theme.css`）；完成的是這一頁的課，就從學習者最後點的地方放彩帶。重新整理或換頁時，已經完成的課不會再播。
- 進度條（`src/styles/theme.css`）：寬度改成 450ms 加 `--vl-ease-out`。

2026-10-21 T-020b 驗證：`npm test` 381 項通過；`check` 0 個錯誤；`check:content`、`build`、`test:exercises`（7 個）都過；`src/components/quiz/browser-smoke.mjs` 41/41。用 Edge 分「正常」和「減少動態」各跑一次：寫錯、寫對、要提示、選錯、選對、完成一課，每個效果都在對的元素上播，減少動態時都不播、也不放彩帶；練習過關不放星星；彩帶 1.2 秒內清掉；重新整理不再播；沒有 console error、沒有橫向捲動（32 項）。第 1 課頁面照 B10 量：外部 .js 17 個 86.4 KB、頁面裡的 `<script>` 5.0 KB，合計 **91.4 KB**（T-010 時 89.3 KB，`fx` 1.5 KB）。

2026-10-21 T-020 驗證：377 項測試通過；check 0 errors／warnings／hints；check:content、build 成功（build 有找不到 docs → 404 的警告）。核心以 Vite `build({configFile:false, build:{write:false,minify:true,lib:{entry:'src/components/fx/fx.ts',formats:['es'],fileName:'fx'}}})` 取得輸出，逐個 JS 用 Node `gzipSync` 加總：原始 3,217 bytes，gzip **1,563 bytes**。這是保留公開 exports 的核心測量，未包含 T-020b 的整合頁面。Edge 通過淺／深色、1440px／375px、提示效果重播、1.2 秒清理、連續 10 次粒子至多一張 canvas，以及播放前／播放中減少動態的驗證；尚未在 Firefox、Safari 或真實手機驗證。
