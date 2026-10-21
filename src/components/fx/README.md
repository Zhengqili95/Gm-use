# Learning feedback effects (T-020)

獨立的效果工具，不讀寫答案、練習狀態或進度。T-020b 由 Claude-A 接入課程。

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
| `pop` | 從 0.85 倍彈到原尺寸；通過記號、完成課程的 ✓ | 320ms |
| `shake` | 左右各 4px 的輕晃；選錯的測驗選項 | 280ms |
| `glow` | 品牌綠外框與陰影亮起再退去；通過的練習卡片 | 900ms |
| `slide-in` | 從上方 6px 淡入定位；新提示 | 200ms |

四種效果也可直接加 `vl-fx-<effect>` class 播一次。使用 `play(el, effect)` 會在結束時清除 class，快速連按從頭播；同一元素一次只播放一種效果，換效果會清除前一個。null、已移除的元素不做事。動畫中途被移除／外部 CSS 停止時，備援計時器最晚在該效果時間加 80ms 清理監聽。目標應使用 block 或 inline-block；對已經有 CSS animation 的元素，建議套在額外的內層元素，避免搶用 animation 屬性。scale／translate 使用獨立屬性，不覆蓋 transform。

## 可選的慶祝

`celebrate(el, 'pass' | 'lesson', { force?: boolean })` 從元素中心噴出 18 顆星星或 64 片彩帶（低於 20／80 上限），1.2 秒內結束。全模組同時至多一張 canvas，新的一次會取代前一次；canvas 不擋點擊且從無障礙樹隱藏。顏色讀取目標的 `--sl-color-accent`、`--sl-color-accent-high`、`--sl-color-white`，支援深／淺主題。粒子持續淡出，不做閃爍或快速明暗切換。

`fx.ts` 匯出的 `FX_PARTICLES` 預設 **false**，定義位於 `fx-logic.ts`。使用者確認後，把該常數改成 true，再重新建置即可啟用。一般課程呼叫不要傳 force；`force: true` 只供示範頁預覽。切換分頁、離開頁面、改變視窗尺寸、移除目標都會提前停止並移除 canvas。

## 減少動態

`prefers-reduced-motion: reduce` 優先於所有開關，包含 force。四種 CSS 動畫完全停播，元素直接呈現原本的最終狀態；JavaScript 不新增動畫或 canvas。播放途中改為減少動態也會立即清理。效果不承擔成功／失敗的語意，呼叫端仍應提供清楚文字與無障礙狀態通知。

## 驗證與示範

- `node --test src/components/fx/fx.test.mjs`：播放政策、粒子上限／起點、可重現的亂數。也包含於 `npm test`。
- 開發頁 `/Gm-use/dev/fx/`：每個效果有按鈕，還有 force 星星／彩帶。`draft: true`，正式建置不產生此頁。
- 啟動獨立 dev server 後執行 `node src/components/fx/browser-check.mjs http://127.0.0.1:4347/Gm-use/dev/fx/` 可重現 Edge 驗收；使用既有 Playwright，不裝瀏覽器。截圖在系統暫存目錄的 `vibe-t020-evidence/`，沒有模型呼叫。
- 驗收需涵蓋連按重播、播放完 class／canvas 清除、深色／淺色、375px、減少動態（包含播放中切換），以及 `npm test`、`npm run check`、`npm run check:content`、`npm run build`。
- 體積以正式 Vite 打包、逐個外部 JS gzip（B10）計算；核心含 `fx-logic.ts`，不計僅供開發的示範頁程式。T-020b 整合後仍需再量完整課程頁，不能直接把核心大小當成整頁結果。

2026-10-21 驗證：377 項測試通過；check 0 errors／warnings／hints；check:content、build 成功（build 有找不到 docs → 404 的警告）。核心以 Vite `build({configFile:false, build:{write:false,minify:true,lib:{entry:'src/components/fx/fx.ts',formats:['es'],fileName:'fx'}}})` 取得輸出，逐個 JS 用 Node `gzipSync` 加總：原始 3,217 bytes，gzip **1,563 bytes**。這是保留公開 exports 的核心測量，未包含 T-020b 的整合頁面。Edge 通過淺／深色、1440px／375px、提示效果重播、1.2 秒清理、連續 10 次粒子至多一張 canvas，以及播放前／播放中減少動態的驗證；尚未在 Firefox、Safari 或真實手機驗證。
