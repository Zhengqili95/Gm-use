# T-019 內容靜態檢查

依 M-035、M-037、D-014 實作，審查者 Claude-B。範圍為本資料夾、
兩個 npm 指令，以及 XML 解析開發套件 saxes；不改 schema、課文或部署設定。
約定 1.2（T-019b）起由 Claude-B 維護：草稿課文放寬、SVG 動畫與同課 id、
錯誤訊息的整理，規則的寫法見 `docs/CONTRACT.md` 的 2.1、第 5 節和 B9。

## 使用

- `npm run check:content`：檢查這份 checkout 的內容。
- `npm run check:content -- --root <專案根目錄>`：根目錄包含 `src/`，
  不會從該目錄載入或執行程式，仍使用檢查器自己的 schema。
- `npm run test:check`：建立完整的暫存內容資料夾，逐條測試正反案例。

通過回傳 0；有任何違規回傳 1，每個違規一行
`錯誤 <檔案>：<原因>`；同一個檔案缺少的必填欄位合成一行
（`缺少必填欄位：contract、lesson、…`）。不存取網路、不執行 MDX 或 SVG。

## 檢查範圍

1. 練習／測驗 YAML 使用 `../schemas.ts` 與 `CONTRACT_VERSION`；
   課文以 `lessonFrontmatter.required()` 加上 Starlight 課程必填欄位檢查。
   草稿（`draft: true`）只必填 `title`、`description`、`sidebar.order`、
   `draft`，其他欄位可以省略，有寫的照常全檢查（`draftSchema`）。
2. 課名、課號、檔名、側欄順序；課號及題號不補零。草稿沒寫 `lesson` 時，
   以檔名 `lesson-N.mdx` 的 N 為準。
3. 檔案存在、同課引用、課文 Exercise 的順序與數量、唯一 Quiz、
   Diagram 的 name／alt／SVG 路徑；未使用的練習／測驗也報錯。
   課文自己有別的格式錯誤時，它在 frontmatter 讀得到的引用仍算已引用；
   那一課的課文沒有寫出 `exercises`／`quiz`（或讀不出 frontmatter）時，
   該課的練習／測驗檔不再連帶報「未被引用」，因為根本原因已經報過。
   草稿沒寫 `exercises`／`quiz` 卻放了 `<Exercise>`／`<Quiz>` 也報錯。
4. 公開課三項 gates 都要 true；草稿不要求 gates，有寫就照常檢查格式。
5. SVG XML 結構、根元素、viewBox、title／desc、字體大小（`<text>`、
   `<tspan>` 的 font-size 可以繼承，至少 14）、節點數、顏色變數、id 與內部
   引用、禁用元素（含 animate／animateColor／animateMotion／
   animateTransform／set／discard 這些動畫元素）／事件／外部連結；
   同一課所有圖解的 id 合起來不能重複（`analyzeSvg` 回傳每張圖的 id，
   `index.mjs` 依課比對）。
6. 測驗正確選項數、題目等細節由唯一來源 quizSchema 負責。

`src/lessons/lesson-0/` 完全略過；只檢查
`src/content/docs/lessons/` 的課文，不檢查首頁或開發頁。
沒有內容目錄的錯誤 root 不會空跑成功。目錄中的符號連結會報錯。

## 實作與驗收安排

- 先以完整正確 fixture 與各項違規 fixture 驗證 CLI／檢查介面，
  觀察缺少驗證時會失敗，再補實作。
- MDX 使用已安裝 Astro 的 Sätteri 語法樹；透過 Astro 的依賴路徑解析，
  不依賴 npm 將間接套件放到頂層。程式碼區塊、行內程式、註解不算引用。
- 元件的 id／name／alt 須使用約定的靜態引號字串；動態運算式與
  spread 不執行、直接報錯。換行與單／雙引號皆可使用。
- SVG 使用 saxes 6.x 的 namespace-aware XML 解析；不載入 DTD 或外部實體。
  顏色僅接受約定變數、none、內部 url；不接受 CSS 跳脫、註解、
  var fallback 或 font shorthand 等難以靜態驗證的寫法。
- 執行 `test:check`、`test:schemas`、`build`；另在目前 repo 執行
  `check:content`，如實回報尚未填完整的佔位課程，不代改他人檔案。

## 人工審查界線

這不是通用 MDX 執行器或 SVG 安全清洗器。SVG 節點數以 defs 外的
rect／circle／ellipse 計數；用 path 畫出的語意節點、文字是否轉成圖形、
是否只靠顏色傳達意思，以及 id 前綴是否能代表圖名，仍須人工審查。
文字有沒有擠到方塊的邊、箭頭旁邊的說明會不會比兩個方塊之間的距離長
（約定第 5 節）也不量：字寬要看實際字型，要在瀏覽器裡看。
id 接受約定範例的縮寫前綴（如 bs-arrow），無法從檔名自動推導作者縮寫。
來源內容的可信度、讀者理解度與真正的練習執行結果不屬於本指令。

更新 Astro／MDX 解析器時，應重跑本測試，確認語法樹介面沒有改變。
