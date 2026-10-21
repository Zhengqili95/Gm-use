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
