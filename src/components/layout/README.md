# 版面元件（T-007 平台外殼）

## `Sidebar.astro`：側邊欄上方的「學習進度」

外殼只放好位置和樣式，數字和進度條由 T-010 的進度元件更新。進度元件要做這四件事：

1. 讀取瀏覽器裡存的進度資料（格式由 `docs/CONTRACT.md` 定義）。
2. 更新 `[data-vl-progress-count]` 的文字，例如「1 / 3 課」。
3. 把 `[data-vl-progress-fill]` 的寬度設成完成比例，例如 `element.style.width = '33%'`。
4. 在側邊欄裡已完成的課程連結（`nav.sidebar a`）加上 `data-vl-done="true"`，CSS 會自動在後面加 ✓。

總課數放在 `[data-vl-progress]` 的 `data-vl-total`，是從側邊欄「課程」群組的連結數算出來的。群組名稱定義在 `astro.config.mjs`，改名時要一起改 `Sidebar.astro`。

樣式在 `src/styles/theme.css` 的「學習進度」段落。

## `IslandCheck.tsx`：示範用的互動元件

只用來確認 Preact 能在 Starlight 頁面裡正常運作。T-009 做好正式的練習元件後，連同 `src/content/docs/lessons/lesson-1.mdx` 裡的引用一起刪掉。
