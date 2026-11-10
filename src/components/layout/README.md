# 版面元件（T-007 平台外殼）

## `Sidebar.astro`：側邊欄上方的「學習進度」

外殼只放好位置和樣式，數字和進度條由 T-010 的進度元件更新。進度元件（`src/components/progress/SidebarProgress.astro`）就放在 `Sidebar.astro` 裡，所以每一頁的側邊欄都會更新，課文不用另外放（M-090）。進度元件要做這四件事：

1. 讀取瀏覽器裡存的進度資料（格式由 `docs/CONTRACT.md` 定義）。
2. 更新 `[data-vl-progress-count]` 的文字，例如「1 / 3 課」。
3. 把 `[data-vl-progress-fill]` 的寬度設成完成比例，例如 `element.style.width = '33%'`。
4. 在側邊欄裡已完成的課程連結（`nav.sidebar a`）加上 `data-vl-done="true"`，CSS 會自動在後面加 ✓。

總課數放在 `[data-vl-progress]` 的 `data-vl-total`，是從側邊欄「課程」群組的連結數算出來的。群組名稱定義在 `astro.config.mjs`，改名時要一起改 `Sidebar.astro`。

樣式在 `src/styles/theme.css` 的「學習進度」段落。

## 首頁（T-012）

- `LessonList.astro`：首頁「三堂課，做出同一張卡」下面的課程卡片。課名、說明、時間從課文的 frontmatter 讀（標題要寫成「第 N 課｜課名」，卡片只放後半）。`draft: true` 的課標「即將推出」、不放連結（D-013 做法 A）；課文改成 `draft: false`，卡片就自動變成可以點。
- `route-data.ts`：Starlight 的路由中介層，在 `astro.config.mjs` 的 `routeMiddleware` 登記。首頁主視覺的按鈕如果連到還沒上線的課，就拿掉；相對連結會補上 `base`（`/Gm-use/`），所以 `index.mdx` 裡照樣寫 `lessons/lesson-1/` 就好。
- `FavToggle.astro`：首頁主視覺那張卡的「☆ 收藏」按鈕，按一下變成「★ 已收藏」。卡片本身寫在 `src/content/docs/index.mdx` 的 `hero.image.html`，樣式在 `src/styles/theme.css`。

## `Footer.astro`、`feedback.ts`：每一課最下面的「回報問題／給建議」（T-012）

規格「朋友的回饋」：每一課最下面放一個連結，連到使用者建立的 Google 表單（T-004）。

- **網址填在 `feedback.ts` 的 `FEEDBACK_FORM_URL`**，只要改這一行；現在填的是使用者在 T-004 做的表單（M-118）。改成空字串的話，哪一頁都不顯示。
- 只接受給填寫的人用的 Google 表單網址（`https://forms.gle/…` 或 `https://docs.google.com/forms/d/…/viewform`，後面的 `?usp=…` 可有可無）。編輯畫面的網址（結尾是 `/edit`）不行，學習者打開會看到「需要存取權」。填錯時 `npm test` 會抓到，`npm run build` 也會失敗，不會把壞掉的連結放上線。
- 只有課程頁（`lessons/lesson-N`）顯示；首頁、404、練習實驗室都不放。連結另開新分頁，不打斷正在讀的課。
- `Footer.astro` 覆寫 Starlight 的頁尾（在 `astro.config.mjs` 的 `components` 登記）：先放回饋連結，再放原本的頁尾（上一頁、下一頁）。樣式在 `src/styles/theme.css` 的「回報問題／給建議」段落。

## 主題選單的「黑色」、可以收合的「本頁內容」（T-022、D-029）

第 1 課的回饋：背景保留墨綠色、多一種黑色可選；右邊的「本頁內容」太佔空間，改成可以展開、收合，預設收起來。前三個 `.astro` 檔覆寫 Starlight 的元件，在 `astro.config.mjs` 的 `components` 登記。

- `ThemeSelect.astro`：主題選單，選項是「墨綠、黑色、淺色、自動」（原本的「深色」改叫「墨綠」）。「黑色」是深色主題換成黑底：`<html>` 一樣是 `data-theme="dark"`，再加上 `data-vl-shade="black"`；顏色寫在 `src/styles/theme.css` 開頭的「黑色」段落，品牌綠不變。
- `TableOfContents.astro`：右邊「本頁內容」的開關。收起來時右欄只剩一條 3rem 的窄欄，內容區在左側欄和窄欄中間置中，最寬 52rem（展開時是 Starlight 原本的 45rem）；練習的編輯區和預覽框也跟著變寬。只有 72rem 以上的螢幕有右欄，比較窄的螢幕照舊用 Starlight 上方的下拉選單。不能跑 JavaScript 時照 Starlight 原本的樣子全部展開。上方搜尋框的對齊用到 Starlight 的內部變數 `--__main-column-fr`；升級 Starlight 之後，要看搜尋框左緣有沒有對齊內容區左緣。
- `ThemeProvider.astro`：Starlight 原本在 `<head>` 設定主題的元件，再加一小段內嵌腳本，在畫面畫出來之前就套用黑色和收合狀態（`<html>` 的 `data-vl-shade`、`data-vl-toc`），免得先閃一下墨綠色、內容區先窄後寬。
- `prefs.ts`：兩個選擇怎麼存在 localStorage。主題沿用 Starlight 的 `starlight-theme`（選黑色時也存 `dark`），另外用 `vl-dark-shade` 記黑色；「本頁內容」存在 `vl-toc`（`open`／`closed`，沒存過就是收起來）。`ThemeProvider.astro` 的內嵌腳本不能 import，讀法寫了同樣的一份，改的時候兩邊一起改。測試在 `prefs.test.mjs`。
