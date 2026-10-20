# vibe-learn 資料格式約定（CONTRACT）

> **狀態**：草稿（T-005，Claude-B 起草，等 Claude-A 審）。
> **版本**：約定 1.1；內容檔的 `contract` 欄位寫 `1`（主版本）。
> **依據**：`docs/SPEC.md`、D-011、D-012（課程順序、提示三層、批改看結果、三課共用「AI 提示詞收藏卡」、練習改一小段、圖解用 SVG）。
> **可執行版本**：格式的細節以 `src/lib/schemas.ts`（zod schema）為準。文件和它不一致時，以 schemas.ts 為準，並在討論區回報，請 Claude-B 修文件。

## 怎麼讀這份文件

| 你是… | 讀哪裡 |
|---|---|
| 寫課程內容的人（Gemini、Claude-B） | **第一部分：內容作者手冊**（要貼給 Gemini 的就是這一部分） |
| 寫程式的人（Claude-A、Claude-B、Codex） | **第二部分：實作備忘** |

兩條共同規則：

1. 每個內容檔都要寫 `contract: 1`。格式或版本不對，`npm run check:content` 會直接報錯，不會悄悄壞掉。
2. 要改約定，走最後一節「怎麼改這份約定」。

---

# 第一部分：內容作者手冊

**30 秒版**：每課交四種檔案（課文 `.mdx`、練習 `.yaml`、測驗 `.yaml`、圖解 `.svg`）。練習看「結果」判斷，不比對程式碼字串；每條檢查規則都要附一句失敗時的提示；提示固定三層；標準答案必須通過所有檢查，起始內容必須至少有一條沒通過。所有檔案都寫 `contract: 1`。

## 1. 一課有哪些檔案

| 內容 | 檔案位置 | 說明 |
|---|---|---|
| 課文 | `src/content/docs/lessons/lesson-N.mdx` | 開場、核心觀念，並指定練習和測驗放在哪 |
| 練習 | `src/lessons/lesson-N/ex-K.yaml` | 一個練習一個檔案（`K` 從 1 開始） |
| 測驗 | `src/lessons/lesson-N/quiz.yaml` | 一課一份，4～5 題 |
| 圖解 | `src/lessons/lesson-N/diagrams/名稱.svg` | 一張圖一個檔案，名稱用小寫英文和連字號 |

`N` 是課號（`1`、`2`、`3`），不補零。課文檔名、資料夾和 id 都用同一個 `N`，網址就是 `/lessons/lesson-N/`；進度元件靠網址裡的 `N` 找出是哪一課。

一課的基本要求（規格書第 4 節）：

- **只學一件事**，學完有一個看得到的成果。
- **15～20 分鐘**。建議分配：閱讀加練習約 15 分鐘（每個練習不超過 3 分鐘）、測驗 3 分鐘、機動 2 分鐘。
- 組成：短文（有圖解和例子）、互動練習、小測驗。
- 練習一律「改一小段」（填空、改一個值、補一行），不要「從零寫」：手機打程式碼很痛苦，自由寫法的自動檢查也不穩。

## 2. 課文檔（MDX）

### 2.1 Frontmatter

檔案最上面用 `---` 包起來的設定區。

| 欄位 | 必填 | 寫法 |
|---|---|---|
| `title` | 是 | 寫成「第 N 課｜課名」 |
| `description` | 是 | 一句話說明這課在做什麼 |
| `sidebar.order` | 是 | 和 `lesson` 一樣的數字（側邊欄照這個排序） |
| `sidebar.label` | 否 | 側邊欄顯示的短名稱，寫成「N. 課名」 |
| `contract` | 是 | 固定寫 `1` |
| `lesson` | 是 | 第幾課（整數） |
| `minutes` | 是 | 預估時間，15～20 的整數 |
| `oneThing` | 是 | 這課只學的一件事，一句話 |
| `result` | 是 | 學完看得到的成果，一句話 |
| `sources` | 是 | 參考來源，至少 2 筆，每筆有 `title` 和 `url`（必須是 `https://`） |
| `exercises` | 是 | 這課所有練習的 id，依出現順序 |
| `quiz` | 是 | 這課測驗的 id |
| `gates` | 是 | 三道關卡的狀態：`sources`（來源）、`review`（交叉審查）、`trial`（使用者試讀）。新課三個都寫 `false` |
| `draft` | 是 | `true` 時正式網站不顯示這一課；**三道關卡都 `true` 才能改成 `false`**（Starlight 內建欄位） |

### 2.2 課文的樣子

每一課都用同樣的開頭，`import` 那四行照抄，不要改：

```mdx
---
title: "第 1 課｜畫面是怎麼拼出來的"
description: "用 HTML、CSS、JavaScript 做出 AI 提示詞收藏卡。"
sidebar:
  order: 1
  label: "1. 畫面是怎麼拼出來的"
contract: 1
lesson: 1
minutes: 20
oneThing: "網頁由三種語言分工：HTML 管結構、CSS 管外觀、JavaScript 管行為"
result: "做出一張可以按「收藏」的提示詞卡片"
sources:
  - title: "MDN：HTML：超文本標記語言"
    url: "https://developer.mozilla.org/zh-TW/docs/Web/HTML"
  - title: "MDN：CSS"
    url: "https://developer.mozilla.org/zh-TW/docs/Web/CSS"
  - title: "MDN：JavaScript"
    url: "https://developer.mozilla.org/zh-TW/docs/Web/JavaScript"
exercises: [lesson-1/ex-1, lesson-1/ex-2, lesson-1/ex-3]
quiz: lesson-1/quiz
gates: { sources: false, review: false, trial: false }
draft: true
---

import Exercise from '../../../components/exercises/Exercise.astro';
import Quiz from '../../../components/quiz/Quiz.astro';
import Diagram from '../../../components/lesson/Diagram.astro';
import { Aside, Steps } from '@astrojs/starlight/components';

## 開場

（不超過 2 分鐘：一個情境，加上「這課結束時你會做出什麼」。）

## HTML：決定「有什麼」

（短文。教到一個概念，就放對應的練習。）

<Exercise id="lesson-1/ex-1" />

## CSS：決定「長什麼樣子」

<Diagram name="lesson-1/three-brothers" alt="三個方塊分別寫著 HTML、CSS、JavaScript，各自負責結構、外觀、行為" />

<Exercise id="lesson-1/ex-2" />

## JavaScript：決定「按下去會怎樣」

<Exercise id="lesson-1/ex-3" />

## 小測驗

<Quiz id="lesson-1/quiz" />
```

### 2.3 可以用的標記

| 標記 | 用途 |
|---|---|
| `<Exercise id="lesson-1/ex-1" />` | 放一個互動練習，放在教那個概念的段落後面 |
| `<Quiz id="lesson-1/quiz" />` | 放小測驗；每課一次，放在最後 |
| `<Diagram name="lesson-1/browser-server" alt="…" />` | 放一張圖解；`alt` 一定要寫，用一句話說明圖在講什麼 |
| `<Aside type="tip" title="標題">…</Aside>` | Starlight 內建的提示框；`type` 可以用 `note`、`tip`、`caution`、`danger` |
| `<Steps>…</Steps>` | Starlight 內建的步驟清單 |

只用上面這些。不要自己 `import` 別的元件，也不要在課文裡寫 `<script>`、`<style>`、`<iframe>`。

`exercises` 清單裡的 id 和課文裡的 `<Exercise id>` 要一一對應：沒有放進課文的練習、或沒列在清單裡的練習，都會報錯。

### 2.4 寫法規則

- **繁體中文（臺灣用語）**：伺服器、資料庫、程式碼、瀏覽器。
- **開發用語保留英文，第一次出現時括號附中文**：「HTML（超文本標記語言）」，之後只寫 HTML。術語以 `docs/GLOSSARY.md` 為準（T-010 會建立；在那之前以交付包附的種子表為準）。表上沒有的新術語，列在交付檔最後的「新術語」清單。
- 先講「為什麼要這樣」，再講「怎麼做」；一段只講一個重點，句子要短。
- 用「你」稱呼學習者。不要寫「很簡單」「只要」這類讓人覺得自己笨的字眼。
- 範例一律用第 6 節的「AI 提示詞收藏卡」和它的資料（虛構的，不含任何真實個資）。
- 事實性的說法要能在 `sources` 找到出處；沒把握的不要寫。
- **用自己的話寫。** 來源只用來查證事實，不要複製文字、例子或圖；也不要照搬其他課程（例如氛圍學院）的內容。
- 第一版不放封面圖、照片或影片；圖只用第 5 節的 SVG 圖解。

### 2.5 參考來源（品質關卡 1）

- 官方文件優先：MDN Web Docs、SQLite 官方文件（sqlite.org）、W3C、WHATWG、IETF 的規格。不用部落格、問答網站和影片。
- 網址要寫完整，而且必須是真的存在的頁面。**不確定的網址不要自己編**，寫在交付檔最後的「需要查證」清單，Claude-B 會逐一打開確認。
- 每課至少 2 筆。

## 3. 練習檔（YAML）

### 3.1 共通欄位

| 欄位 | 必填 | 說明 |
|---|---|---|
| `contract` | 是 | 固定 `1` |
| `id` | 是 | 例如 `lesson-1/ex-1`；必須等於「資料夾名／檔名（不含 `.yaml`）」 |
| `type` | 是 | `preview`（HTML／CSS／JavaScript 即時預覽）、`api`（模擬伺服器）、`sql`（SQLite） |
| `title` | 是 | 練習標題，短 |
| `goal` | 是 | 學習者要做到什麼，一句話；顯示在練習最上面 |
| `minutes` | 是 | 預估時間，1～3 的整數 |
| `checks` | 是 | 檢查規則，至少一條（3.3） |
| `hints` | 是 | 剛好三則提示（3.4） |
| `success` | 是 | 過關後顯示的一句話，說明剛剛學到什麼 |

### 3.2 各類型的專屬欄位

**`preview` 和 `api`**

| 欄位 | 必填 | 說明 |
|---|---|---|
| `files` | 是 | 起始內容。只有三個檔名可用：`index.html`（必有）、`style.css`、`script.js`。`index.html` 只寫 `<body>` 裡面的內容（不寫 `<html>`、`<head>`、`<body>`），並用 `<link rel="stylesheet" href="style.css">` 和 `<script src="script.js"></script>` 參照另外兩個檔案。有 `style.css` 就一定要參照它，`script.js` 也一樣 |
| `editable` | 是 | 學習者可以改的檔案；建議只放一個 |
| `solution` | 是 | 標準答案：只寫有改動的檔案，內容要是完整的檔案 |
| `previewHeight` | 否 | 預覽區高度（px），120～480，預設 220 |

`api` 另外要有：

| 欄位 | 必填 | 說明 |
|---|---|---|
| `api.routes` | 是 | 模擬伺服器的路由清單（3.5） |

**`sql`**

| 欄位 | 必填 | 說明 |
|---|---|---|
| `setup` | 是 | 建立資料表和資料的 SQL；每次執行前都會在乾淨的資料庫上重跑一次 |
| `starter` | 是 | 編輯器一開始的內容 |
| `solution` | 是 | 標準答案（SQL 文字） |
| `errorHint` | 否 | SQL 寫錯（語法錯誤）時多顯示的一句話 |

### 3.3 檢查規則（checks）

**看結果，不比對程式碼字串。** 字串比對會因為多一個空格、換行或換個寫法就判錯，非常勸退新手。HTML／CSS／JavaScript 檢查畫面最後的樣子，API 檢查送出的請求和畫面的結果，SQL 檢查查詢出來的資料。

- 一個練習 1～4 條檢查，全部通過才過關。
- 每條檢查都要有 `id`（小寫英文、數字和連字號，同一練習內不重複）和 `hint`（沒通過時立刻顯示的一句話：指出「哪裡」不對，但不直接給答案）。
- 寫得寬鬆一點：同一個目標可能有好幾種正確寫法，用 `oneOf`、`includes`、`matches` 接住，不要只認你心裡的那一種。

| `type` | 用在 | 欄位 | 判斷方式 |
|---|---|---|---|
| `exists` | preview、api | `selector`；`count`（可省略） | 找得到元素。`count` 可以寫整數（剛好幾個），或 `{ min: 1, max: 3 }`（`min`、`max` 至少寫一個，而且 `min` 不能大於 `max`；`request` 的 `times` 也是同樣的寫法） |
| `text` | preview、api | `selector`；`equals`、`includes`、`matches` 三選一；`all`、`ignoreCase`（可省略） | 元素的文字符合。比對前會把連續空白壓成一個空格並去掉頭尾。`matches` 是規則運算式（不用寫斜線和旗標）。預設看第一個符合的元素，`all: true` 則每一個都要符合 |
| `attr` | preview、api | `selector`、`name`；`equals`、`includes`、`matches`、`present` 四選一 | 屬性值符合（比對前和 `text` 一樣，先把連續空白壓成一個空格）；`present: true` 表示有這個屬性就好，`present: false` 表示不能有這個屬性 |
| `style` | preview、api | `selector`、`property`；`equals` 或 `oneOf` 二選一 | 瀏覽器實際算出來的樣式符合。顏色可以寫名稱、`#hex`、`rgb()`，會先統一換算再比；長度會換算成 px。**不要用百分比（`50%`）、`auto` 這類要看外層才算得出來的值**，換算出來的會和目標元素不同 |
| `noError` | preview、api | — | 載入和 `steps` 期間，沒有未處理的 JavaScript 錯誤 |
| `request` | api | `method`、`path`；`times`、`query`、`bodyIncludes`（可省略） | 學習者的程式送出了符合的請求。`times` 預設至少一次；`bodyIncludes` 只比對你寫出的欄位 |
| `rows` | sql | `equals`；`columns`、`ordered`（可省略） | 學習者最後一個會回傳資料列的語句，結果符合。預設不管順序，要比順序就寫 `ordered: true` |
| `state` | sql | `query`、`equals`；`ordered`（可省略） | 執行完學習者的語句之後，再執行 `query`，結果符合。用在 `INSERT`、`UPDATE` 這類不回傳資料的語句 |

**steps（先操作，再判斷）**：`preview` 和 `api` 的檢查可以加 `steps`，在判斷之前先在畫面上操作。每條檢查都從重新載入的頁面開始，所以前一條檢查的操作不會影響下一條。

| step | 寫法 | 做什麼 |
|---|---|---|
| 點擊 | `- click: "#fav"` | 點一下符合的元素 |
| 輸入 | `- input: { selector: "#name", value: "abc" }` | 把文字填進輸入框 |
| 等待 | `- wait: 200` | 等幾毫秒（最多 1000） |

**SQL 比對規則**：數字用數值比（`1` 和 `1.0` 一樣），文字要完全相同，`null` 寫 `null`；欄位名稱大小寫要和資料庫回傳的一樣。

**一定要做到**：標準答案必須通過所有檢查；起始內容必須至少有一條沒通過。建置時會自動測試，壞掉的練習會報錯。

**好的寫法和壞的寫法**

| 想檢查什麼 | 壞：看程式碼 | 好：看結果 |
|---|---|---|
| 標題改成新文字 | 用規則運算式在 `index.html` 裡找 `<h2>新標題</h2>` | `type: text`、`selector: "#title"`、`equals: "新標題"` |
| 按鈕按下去會變 | 檢查程式碼有沒有 `addEventListener` | `type: text`，`steps` 先 `click: "#fav"`，再看 `#fav` 的文字 |
| 查出已收藏的卡片 | 比對 `SELECT ... WHERE favorite = 1` 這串字 | `type: rows`，比對查出來的資料列 |

### 3.4 三層提示（hints）

`hints` 剛好三則，順序固定：

1. **觀念提醒**：講這題用到的觀念。不提位置，不給程式碼。
2. **檢查位置**：告訴學習者要看哪個檔案、哪一行或哪一段。不給答案。
3. **語法範例**：給一個「類似但不一樣」的寫法，讓學習者自己套用到這題。不能是標準答案本身。

學習者看完三層（或失敗三次）才會出現「看答案」按鈕，所以答案不用藏在提示裡，也不要在提示裡直接寫答案。

另外，每條檢查自己的 `hint` 是「結果提示」：哪條沒過就先顯示哪一條，和三層提示分開。

### 3.5 模擬伺服器（api 類型）

學習者的程式用 `fetch` 向模擬伺服器要資料；這個伺服器只存在於瀏覽器裡，不會真的連網。

| 欄位 | 必填 | 說明 |
|---|---|---|
| `path` | 是 | 以 `/` 開頭，例如 `/prompts` |
| `method` | 否 | `GET`（預設）、`POST`、`PUT`、`PATCH`、`DELETE` |
| `status` | 否 | 回應的狀態碼，預設 200 |
| `body` | 否 | 回應的內容（寫成 YAML，會轉成 JSON 送出） |
| `headers` | 否 | 回應標頭 |
| `delayMs` | 否 | 假裝等待幾毫秒，0～1500，用來讓學習者看到「載入中」 |

沒有對到任何路由的請求，會得到 404 和 `{ "error": "Not Found" }`。這一版只支援 `fetch`。學習者會看到一份「請求紀錄」（方法、網址、狀態碼）。

### 3.6 範例

下面三個範例只示範格式，不是第 1～3 課的最終內容；每課的練習請依大綱重新設計。

**preview：改文字（HTML）**

```yaml
# src/lessons/lesson-1/ex-1.yaml
contract: 1
id: lesson-1/ex-1
type: preview
title: "改掉卡片的標題"
goal: "把卡片的標題改成「我的第一張提示詞卡」"
minutes: 2
files:
  index.html: |
    <article class="card">
      <h2 id="title">寫一封請假信</h2>
      <p id="body">請幫我寫一封給老師的請假信，語氣有禮貌，100 字以內。</p>
    </article>
editable: [index.html]
solution:
  index.html: |
    <article class="card">
      <h2 id="title">我的第一張提示詞卡</h2>
      <p id="body">請幫我寫一封給老師的請假信，語氣有禮貌，100 字以內。</p>
    </article>
checks:
  - id: title-text
    type: text
    selector: "#title"
    equals: "我的第一張提示詞卡"
    hint: "標題在 h2 標籤裡面；要改的是標籤中間的文字，不是標籤本身。"
hints:
  - "HTML 用標籤把內容包起來，標籤中間的文字就是畫面上看到的字。"
  - "找到 id 是 title 的那一行，標籤中間的文字就是現在的標題。"
  - "<p>你好</p> 會顯示「你好」；把中間的字換掉，畫面就跟著換。"
success: "標題換好了！你剛剛改的是 HTML 的「內容」。"
```

**preview：改外觀（CSS）**

```yaml
# src/lessons/lesson-1/ex-2.yaml
contract: 1
id: lesson-1/ex-2
type: preview
title: "幫卡片換個顏色"
goal: "把卡片的背景顏色改成淡黃色（lightyellow）"
minutes: 2
files:
  index.html: |
    <link rel="stylesheet" href="style.css">
    <article class="card">
      <h2 id="title">寫一封請假信</h2>
      <p id="body">請幫我寫一封給老師的請假信，語氣有禮貌，100 字以內。</p>
    </article>
  style.css: |
    .card {
      padding: 16px;
      border: 1px solid #999999;
      background-color: white;
    }
editable: [style.css]
solution:
  style.css: |
    .card {
      padding: 16px;
      border: 1px solid #999999;
      background-color: lightyellow;
    }
checks:
  - id: card-background
    type: style
    selector: ".card"
    property: background-color
    equals: "lightyellow"
    hint: "背景顏色寫在 .card 的大括號裡，找 background-color 那一行。"
hints:
  - "CSS 用「屬性: 值;」的格式設定外觀，背景顏色就是一個屬性。"
  - "打開 style.css，找到 .card 大括號裡的 background-color 那一行，改的是冒號後面的值。"
  - "background-color: pink; 會讓背景變粉紅色；換成這題要的顏色名稱就好。"
success: "顏色換好了！CSS 決定長相，不會動到內容。"
```

**preview：加上行為（JavaScript，用到 steps）**

```yaml
# src/lessons/lesson-1/ex-3.yaml
contract: 1
id: lesson-1/ex-3
type: preview
title: "按下去會怎樣"
goal: "補上一行，讓按鈕被按下去以後，文字變成「★ 已收藏」"
minutes: 3
files:
  index.html: |
    <article class="card">
      <h2 id="title">寫一封請假信</h2>
      <button id="fav" type="button">☆ 收藏</button>
    </article>
    <script src="script.js"></script>
  script.js: |
    const button = document.getElementById("fav");

    button.addEventListener("click", function () {
      // 在這裡補上一行：把按鈕的文字改成「★ 已收藏」
    });
editable: [script.js]
solution:
  script.js: |
    const button = document.getElementById("fav");

    button.addEventListener("click", function () {
      button.textContent = "★ 已收藏";
    });
checks:
  - id: starts-unfavorited
    type: text
    selector: "#fav"
    equals: "☆ 收藏"
    hint: "還沒按之前，按鈕的文字應該還是「☆ 收藏」，不要動到它。"
  - id: after-click
    type: text
    selector: "#fav"
    equals: "★ 已收藏"
    steps:
      - click: "#fav"
    hint: "按下按鈕之後文字沒有變；看看 click 事件的大括號裡，有沒有補上改文字的那一行。"
  - id: no-errors
    type: noError
    steps:
      - click: "#fav"
    hint: "程式出錯了；通常是少了分號、括號或引號，檢查你補的那一行。"
hints:
  - "JavaScript 可以在事件發生時（例如按下按鈕）執行一段程式，去改畫面上的東西。"
  - "看 script.js 的 click 事件：大括號裡的註解就是要補上程式的地方。"
  - "title.textContent = \"新標題\"; 會把 title 這個元素的文字換成新標題。"
success: "你讓按鈕「有反應」了！這就是 JavaScript 管的行為。"
```

**api：向模擬伺服器要資料**

```yaml
# src/lessons/lesson-2/ex-1.yaml
contract: 1
id: lesson-2/ex-1
type: api
title: "向伺服器要提示詞清單"
goal: "補上網址，讓頁面向伺服器要提示詞，並把每張卡片的標題列出來"
minutes: 3
api:
  routes:
    - method: GET
      path: /prompts
      status: 200
      body:
        - { id: 1, title: "寫一封請假信", tag: "寫作", favorite: false }
        - { id: 2, title: "解釋程式錯誤", tag: "程式", favorite: true }
files:
  index.html: |
    <ul id="list"></ul>
    <script src="script.js"></script>
  script.js: |
    async function loadPrompts() {
      const response = await fetch(/* 在這裡補上網址 */);
      const cards = await response.json();
      const list = document.getElementById("list");
      for (const card of cards) {
        const item = document.createElement("li");
        item.textContent = card.title;
        list.appendChild(item);
      }
    }
    loadPrompts();
editable: [script.js]
solution:
  script.js: |
    async function loadPrompts() {
      const response = await fetch("/prompts");
      const cards = await response.json();
      const list = document.getElementById("list");
      for (const card of cards) {
        const item = document.createElement("li");
        item.textContent = card.title;
        list.appendChild(item);
      }
    }
    loadPrompts();
checks:
  - id: sent-get
    type: request
    method: GET
    path: /prompts
    hint: "伺服器沒有收到請求；看看 fetch 的括號裡有沒有填網址，網址要指到「提示詞清單」放的位置。"
  - id: list-shown
    type: exists
    selector: "#list li"
    count: 2
    hint: "請求成功了嗎？清單裡應該要有 2 張卡片的標題。"
hints:
  - "瀏覽器要資料時，會向伺服器的某個網址送出請求，網址就像資料的地址。"
  - "看 fetch 的括號：現在是空的，要放進伺服器上「提示詞清單」的網址。"
  - "fetch(\"/hello\") 會向 /hello 這個網址要資料；把它換成這題的網址。"
success: "你送出了第一個請求，也收到了回應！"
```

**sql：查詢資料**

```yaml
# src/lessons/lesson-3/ex-1.yaml
contract: 1
id: lesson-3/ex-1
type: sql
title: "找出已收藏的提示詞"
goal: "寫一個 SELECT，只列出已收藏（favorite 等於 1）的卡片標題"
minutes: 3
setup: |
  CREATE TABLE prompts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    tag TEXT,
    favorite INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO prompts (title, body, tag, favorite) VALUES
    ('寫一封請假信', '請幫我寫一封給老師的請假信，語氣有禮貌，100 字以內。', '寫作', 0),
    ('解釋程式錯誤', '我的程式出現這個錯誤：（貼上錯誤訊息）。請用國中生聽得懂的方式解釋原因。', '程式', 1),
    ('整理上課筆記', '請把下面的筆記整理成三個重點，每個重點一句話：（貼上筆記）', '學習', 0);
starter: |
  SELECT title FROM prompts;
solution: |
  SELECT title FROM prompts WHERE favorite = 1;
errorHint: "檢查關鍵字有沒有拼錯，以及每個語句最後有沒有分號。"
checks:
  - id: only-favorites
    type: rows
    columns: [title]
    equals:
      - ["解釋程式錯誤"]
    hint: "現在會列出全部的卡片；要加上條件，只留下 favorite 等於 1 的。"
hints:
  - "SELECT 會列出資料表裡的資料；加上 WHERE 可以只留下符合條件的那幾列。"
  - "看你的語句：SELECT title FROM prompts 後面，還缺一段「條件」。"
  - "SELECT name FROM pets WHERE age = 3; 只會列出 age 等於 3 的寵物名字。"
success: "你用條件挑出想要的資料了！這就是 WHERE。"
```

`INSERT`、`UPDATE` 這類不回傳資料的語句，用 `state` 檢查「做完之後資料表變成什麼樣子」：

```yaml
checks:
  - id: row-added
    type: state
    query: "SELECT title, favorite FROM prompts WHERE title = '我的新提示詞'"
    equals:
      - ["我的新提示詞", 0]
    hint: "資料表裡還找不到這張新卡片；INSERT 之後，用 SELECT 查查看。"
```

## 4. 測驗檔（YAML）

- 一課一份，4～5 題（最少 3、最多 6）。每題 3～4 個選項，**剛好一個** `correct: true`。
- 每個選項都要有 `explain`（一～兩句）：答對時說明為什麼對，答錯時指出常見的誤解。學習者選了哪個，就會看到哪個的說明。
- 考的是理解，不是背誦；不要出「以上皆是」「以上皆非」；選項的長度盡量接近。
- 題目 id 用 `q1`、`q2`…；選項的順序網站會自己打亂，不用管。
- `code` 可以放一小段程式碼，顯示在題目下面（可省略）。

```yaml
# src/lessons/lesson-1/quiz.yaml
contract: 1
id: lesson-1/quiz
questions:
  - id: q1
    prompt: "哪一種語言負責網頁的「結構」，也就是這裡有標題、那裡有按鈕？"
    options:
      - text: "HTML"
        correct: true
        explain: "對。HTML 用標籤說明哪一塊是標題、段落或按鈕。"
      - text: "CSS"
        explain: "CSS 管的是外觀，例如顏色和間距，不決定「有什麼」。"
      - text: "JavaScript"
        explain: "JavaScript 管的是行為，例如按下按鈕之後發生什麼事。"
  - id: q2
    prompt: "你想讓卡片的背景變成淡黃色，應該改哪裡？"
    options:
      - text: "HTML 的標籤"
        explain: "標籤決定內容的種類；顏色是外觀，不是 HTML 的工作。"
      - text: "CSS 的 background-color"
        correct: true
        explain: "對。background-color 是 CSS 的屬性，專門設定背景顏色。"
      - text: "JavaScript 的 click 事件"
        explain: "click 事件是「按下去之後」才會發生的行為，和顏色設定無關。"
  - id: q3
    prompt: "下面這段程式碼，按下按鈕之後會發生什麼事？"
    code: |
      button.addEventListener("click", function () {
        button.textContent = "★ 已收藏";
      });
    options:
      - text: "按鈕的文字變成「★ 已收藏」"
        correct: true
        explain: "對。click 事件發生時，大括號裡的程式就會執行，把文字換掉。"
      - text: "什麼都不會發生，要重新整理網頁才有用"
        explain: "事件一發生，程式就會馬上執行，不用重新整理。"
      - text: "整張卡片被刪掉"
        explain: "這段程式只改了按鈕的文字，沒有刪除任何東西。"
```

## 5. 圖解（SVG）

一張圖一個 `.svg` 檔，用 `<Diagram name="lesson-1/名稱" alt="…" />` 放進課文。

**規則**

- 只有一個 `<svg>`，有 `xmlns="http://www.w3.org/2000/svg"` 和 `viewBox="0 0 寬 高"`；**寬在 320～480 之間**（手機上才看得清楚）。不寫固定的 `width`、`height`。
- 第一個子元素是 `<title>`（圖的短名稱），接著 `<desc>`（一句話說明）。
- 文字只用 `<text>`，字體大小至少 14（以 viewBox 的單位計）。不要把文字畫成圖形。
- **顏色只能寫在 `style` 屬性裡，並且用下表的變數**。不要寫死顏色（`#336699`、`red`、`rgb(…)`），這樣網站切到深色模式時，圖才會跟著變色。`fill="none"` 可以用。
- 圖裡的 `id`（例如箭頭的 `<marker id>`）要加圖的名稱當前綴，例如 `bs-arrow`，因為整個網頁的 `id` 不能重複。
- 不可以有：`<script>`、`<style>`、`<foreignObject>`、`<image>`、`on…` 事件屬性，以及指向外部的連結（`href`、`xlink:href` 只能指向同一個檔案裡的 `#id`）。
- 一張圖最多 8 個方塊或節點；不要只靠顏色傳達意思，要配上文字。

**可用的顏色變數**（寫成 `style="fill: var(--sl-color-text)"` 的形式）

| 用途 | 變數 |
|---|---|
| 文字、線條 | `--sl-color-text` |
| 一般方框的底色、邊框 | `--sl-color-gray-6`、`--sl-color-gray-4` |
| 強調（重點方框、箭頭）、淡底 | `--sl-color-accent`、`--sl-color-accent-low` |
| 頁面底色 | `--sl-color-bg` |
| 狀態色：成功、錯誤、注意、資訊 | `--sl-color-green`、`--sl-color-red`、`--sl-color-orange`、`--sl-color-blue`；淡底加 `-low` |

不要用 `--sl-color-white`、`--sl-color-black`：這兩個在深色和淺色模式下的意思會對調。

```svg
<!-- src/lessons/lesson-1/diagrams/browser-server.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 170">
  <title>瀏覽器向伺服器要檔案</title>
  <desc>瀏覽器送出請求給伺服器，伺服器把網頁檔案回傳，瀏覽器再把它畫出來。</desc>
  <defs>
    <marker id="bs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--sl-color-accent)"/>
    </marker>
  </defs>
  <rect x="10" y="50" width="120" height="70" rx="10" style="fill: var(--sl-color-gray-6); stroke: var(--sl-color-gray-4); stroke-width: 1.5"/>
  <text x="70" y="91" text-anchor="middle" font-size="16" style="fill: var(--sl-color-text)">瀏覽器</text>
  <rect x="270" y="50" width="120" height="70" rx="10" style="fill: var(--sl-color-gray-6); stroke: var(--sl-color-gray-4); stroke-width: 1.5"/>
  <text x="330" y="91" text-anchor="middle" font-size="16" style="fill: var(--sl-color-text)">伺服器</text>
  <line x1="135" y1="70" x2="262" y2="70" marker-end="url(#bs-arrow)" style="stroke: var(--sl-color-accent); stroke-width: 2"/>
  <text x="200" y="60" text-anchor="middle" font-size="14" style="fill: var(--sl-color-text)">請求</text>
  <line x1="265" y1="105" x2="138" y2="105" marker-end="url(#bs-arrow)" style="stroke: var(--sl-color-accent); stroke-width: 2"/>
  <text x="200" y="130" text-anchor="middle" font-size="14" style="fill: var(--sl-color-text)">回應（網頁檔案）</text>
</svg>
```

## 6. 共用範例：「AI 提示詞收藏卡」

三課用同一張卡片、同一份資料（D-012）：第 1 課做出畫面，第 2 課資料改成向伺服器要，第 3 課看資料存在資料庫的哪裡。**欄位名稱固定**，內容可以微調。

**畫面（第 1 課）**：元素的 `id` 固定為 `title`、`body`、`tag`、`fav`。

```html
<article class="card">
  <h2 id="title">寫一封請假信</h2>
  <p id="body">請幫我寫一封給老師的請假信，語氣有禮貌，100 字以內。</p>
  <p class="meta"><span id="tag">寫作</span></p>
  <button id="fav" type="button">☆ 收藏</button>
</article>
```

**資料（三筆，虛構）**

| id | title | body | tag | favorite |
|---|---|---|---|---|
| 1 | 寫一封請假信 | 請幫我寫一封給老師的請假信，語氣有禮貌，100 字以內。 | 寫作 | 否 |
| 2 | 解釋程式錯誤 | 我的程式出現這個錯誤：（貼上錯誤訊息）。請用國中生聽得懂的方式解釋原因。 | 程式 | 是 |
| 3 | 整理上課筆記 | 請把下面的筆記整理成三個重點，每個重點一句話：（貼上筆記） | 學習 | 否 |

- **第 2 課（API）**：`GET /prompts` 回傳這三筆組成的陣列，`favorite` 用 `true`／`false`；`GET /prompts/2` 回傳單一筆；找不到的 id 回 404 和 `{ "error": "找不到這張卡片" }`；新增用 `POST /prompts`（回 201）。
- **第 3 課（SQLite）**：資料表 `prompts(id, title, body, tag, favorite)`，`favorite` 用 `0`／`1`（SQLite 沒有真假值，這點要在課文裡提一句）。

## 7. 交付格式與自我檢查表

### 7.1 怎麼交付

一整課可以一次交完，也可以**分兩次交**（一整課可能超過一次回覆的長度）。每次交付都是**一份 Markdown 文件**，每個檔案一個區塊，格式如下。

````
## FILE: src/content/docs/lessons/lesson-1.mdx
```mdx
（檔案的完整內容）
```

## FILE: src/lessons/lesson-1/ex-1.yaml
```yaml
（檔案的完整內容）
```
````

- 順序：課文 → 練習（`ex-1`、`ex-2`…）→ 測驗 → 圖解（每張一個區塊）→ `## 給審稿人的備註`。
- **分兩次交的話**：第一次交「課文＋練習」，第二次交「測驗＋圖解＋給審稿人的備註」，兩次都用同樣的 `## FILE:` 格式；第二次的開頭寫一句「接續第一次」。
- 內含 ``` 的檔案外層改用四個反引號，避免區塊提早結束。
- 檔案內容要完整，不要用「…」或「（同上）」省略；程式碼區塊裡不要放說明文字。
- 備註要寫：新術語清單、需要查證的事實或網址、和約定不一樣的地方（若有）、你自己不確定的地方。
- 收到的成員會把整份原文存成 `team/drafts/gemini-第N課.md`（D-012），再拆成上面的檔案；分兩次交的話，存成 `gemini-第N課-上.md` 和 `gemini-第N課-下.md`（有新版本再加 `-v2`）。`gates` 一律先寫 `false`、`draft` 寫 `true`。

### 7.2 YAML 寫法提醒

1. 縮排用 2 個空格，不要用 Tab。
2. 單行文字一律用**雙引號**包起來；文字裡需要引號時，改用「」，不要用 ASCII 的雙引號。
3. 程式碼（HTML、CSS、JavaScript、SQL）一律用 `|` 區塊。
4. 選擇器（`"#title"`、`".card"`）一定要加引號，因為 `#` 在 YAML 裡是註解的開頭。
5. `true`、`false`、`null` 和數字不加引號。
6. 冒號後面要有一個空格。

### 7.3 自我檢查表

交出去之前，逐項確認：

- [ ] 每個檔案第一層都有 `contract: 1`，而且每個 `id` 等於「資料夾名／檔名」。
- [ ] 只學一件事；閱讀加練習加測驗合計 15～20 分鐘。
- [ ] 每個練習只改一小段；`goal` 一句話說清楚；`minutes` 不超過 3。
- [ ] 每條檢查都有 `id` 和 `hint`；檢查看的是結果，不是程式碼字串。
- [ ] 標準答案通過所有檢查；起始內容至少有一條沒通過。
- [ ] 三層提示的順序是：觀念提醒、檢查位置、語法範例；第三層不是標準答案。
- [ ] 測驗每題剛好一個正確答案，每個選項都有 `explain`。
- [ ] 圖解沒有寫死的顏色、沒有外部連結，`viewBox` 寬度在 320～480。
- [ ] 術語第一次出現時附了中文；新術語列在備註。
- [ ] `sources` 至少 2 筆，都是官方文件；沒把握的網址寫在備註，沒有自己編。
- [ ] 用自己的話寫，沒有複製來源或其他課程的內容。

---

# 第二部分：實作備忘

## B1. 資料夾與接線

```
src/content/docs/lessons/lesson-N.mdx    課文（Starlight 的 docs collection）
src/lessons/lesson-N/ex-K.yaml           練習資料
src/lessons/lesson-N/quiz.yaml           測驗資料
src/lessons/lesson-N/diagrams/*.svg      圖解
src/lib/schemas.ts                       格式定義（zod），唯一的格式來源
src/lib/…                                共用程式（進度儲存、練習執行共用的型別等）
src/components/exercises/                練習元件（Exercise.astro、Preact 元件、執行器）
src/components/quiz/                     測驗元件
src/components/progress/                 進度元件
src/components/lesson/Diagram.astro      圖解元件
```

**`Diagram.astro`**：用 `import.meta.glob('/src/lessons/*/diagrams/*.svg', { query: '?raw', import: 'default', eager: true })` 取得 SVG 文字，直接內嵌進頁面（不用 `<img>`，`var(--sl-color-…)` 才會套用到頁面的主題）。外框是 `<figure>`，`max-width: 32rem` 並置中，SVG 本身 `width: 100%; height: auto`；`alt` 放在圖外面一層 `<div>` 的 `role="img"` 和 `aria-label`（不放在 `<figure>` 上，這樣 `<figcaption>` 還是讀得到）；`caption` 可省略。第 5 節的範例圖我已經放進 Claude-A 的外殼實際看過，深色和淺色模式都清楚。

`src/content.config.ts` 只負責接線（外殼 commit 之後，由 T-005 的 branch 接上；Claude-A 在 M-022 同意）：

```ts
docs:      defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: lessonFrontmatter }) }),
exercises: defineCollection({ loader: glob({ pattern: '**/ex-*.yaml', base: './src/lessons' }), schema: exerciseSchema }),
quizzes:   defineCollection({ loader: glob({ pattern: '**/quiz.yaml', base: './src/lessons' }), schema: quizSchema }),
```

- `lessonFrontmatter` 的欄位全部可省略，因為 docs collection 也包含首頁等非課程頁；「`lessons/` 底下的檔案一定要有這些欄位」由 `check:content` 檢查。
- 資料項目的 `id` 由 Astro 依「檔案路徑（相對於 `base`、不含副檔名）」產生（官方文件的說法）；檔案裡自己寫的 `id` 必須和它一致，`check:content` 會核對，萬一 Astro 的規則和預期不同，會在第一次建置時發現。

## B2. 練習元件（T-009）

**`Exercise.astro`**：接收 `id`，用 `getEntry('exercises', id)` 取資料；找不到就讓建置失敗。它負責把資料交給 Preact 元件（`client:visible`），課文作者不用寫任何 `client:` 指令。

**畫面**：目標（`goal`）→ 編輯區（只列 `editable` 的檔案；其他檔案唯讀、預設收合）→ 預覽區（preview、api）／資料表面板與結果表格（sql）→ 結果訊息 → 按鈕。

| 按鈕 | 說明 |
|---|---|
| 執行 | preview：改程式後自動更新（停止輸入 500 ms 後）；api、sql：按了才執行 |
| 檢查 | 跑全部檢查；過了就標記完成並顯示 `success` |
| 給我提示 | 依序顯示三層提示 |
| 看答案 | 出現時機見下；顯示 `solution`（唯讀），旁邊有「套用答案」把它填進編輯區 |
| 重設 | 還原成起始內容 |

**狀態**

```
todo ──(檢查沒過)──▶ attempted ──(檢查過了)──▶ passed
                        └──(看了答案、套用後檢查過了)──▶ revealed
```

- 檢查沒過：只顯示「第一條沒過的檢查」的 `hint`，並提示還有幾條沒過。
- 「看答案」在三層提示都看過、或檢查失敗滿 3 次之後才出現（規格書：先給提示，再讓學習者選要不要看答案）。
- `passed` 和 `revealed` 都算完成；`revealed` 在進度裡另外標示。
- 檢查**逾時**也算一次沒通過，不然學習者卡在無窮迴圈時，永遠等不到「看答案」。
- **還原**：重新整理後，等元件水合（hydrate）完成，才把儲存的程式碼和進度讀回來，這樣才不會和伺服器端渲染出來的內容對不起來。
- **自動存檔**：編輯後 300 ms 把目前的檔案存進進度儲存（B7），執行前也存一次，所以重新整理之後程式碼不會丟。
- **無窮迴圈**：學習者的迴圈如果一次跑超過 1 秒，會被迴圈保護中止（B3）；預覽每次更新都換一個新的 iframe；預覽一直沒有回應時，顯示提示和「重新整理頁面」按鈕。

**手機**：編輯區用 `<textarea>`（`spellcheck="false"`、`autocapitalize="off"`、`autocorrect="off"`，字體至少 16px 避免 iOS 自動放大），預覽區疊在編輯區下面，按鈕要夠大。第一版不用 CodeMirror 或 Monaco（太重，手機也不好用）。

## B3. 預覽執行器與安全（preview、api）

- `<iframe sandbox="allow-scripts">`：**不要**加 `allow-same-origin`、`allow-forms`、`allow-modals`、`allow-popups`。所以 `alert()` 不會跳出，課文不要用。
- 用 `srcdoc` 組出整份文件：`<meta>` 內容安全政策（CSP）、執行器程式、學習者的 `index.html`（本文）。CSP：`default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'`。沒有寫 `connect-src`，所以學習者的程式連不到任何外部網路。
- 虛擬檔案內嵌：把 `<link href="style.css">` 換成 `<style>…</style>`，把 `<script src="script.js"></script>` 換成 `<script>…</script>`（內容裡的 `</script>` 要跳脫）。
- **訊息協定**（父頁和 iframe 靠 `postMessage` 溝通）：

| 方向 | 訊息 |
|---|---|
| 父頁 → iframe | `{ source: 'vibe', type: 'run', steps, checks }`：一個 case |
| 父頁 → iframe | `{ source: 'vibe', type: 'ping' }`：預覽的看門狗；載入完成的頁面回一則 `ready` |
| iframe → 父頁 | `{ source: 'vibe', type: 'ready' }`：`load` 事件之後再等 100 ms |
| iframe → 父頁 | `{ source: 'vibe', type: 'result', results: [{ id, passed }], requests, errors }` |

  sandbox 的 iframe 來源是字串 `"null"`，沒辦法比對來源網址，所以父頁用 `event.source === iframe.contentWindow` 確認，iframe 用 `event.source === window.parent` 確認。
- **case**：`steps` 完全相同的檢查合成一個 case；每個 case 都從重新載入的 iframe 開始。單一 case 逾時 3 秒，逾時就讓這個 case 的檢查全部失敗並顯示「程式執行太久」。沒有 steps 的 case 逾時（程式一載入就停不下來），後面的 case 直接算失敗，不再各等一次逾時。
- **`style` 比對**：建一個暫時的探針元素，把檢查的 `equals` 值設上去，讀它算出來的樣式，再和目標元素算出來的樣式比；這樣 `lightyellow`、`#ffffe0`、`rgb(255,255,224)` 都會算成同一個值。探針用完立刻拿掉（留在頁面裡會影響同一個 case 後面的檢查）。百分比這類要看外層才算得出來的值（`width: 50%`），在探針上算出來的會和目標元素不同，檢查規則不要用（3.3）。
- **`noError`**：執行器在學習者的程式之前先掛上 `error` 和 `unhandledrejection` 的監聽。
- **結果驗證**：父頁收到 `result` 時不照單全收（學習者的程式和執行器在同一個 iframe，什麼訊息都可能送出來）：只接受這個 case 的檢查 id，格式不對或沒回報的檢查算沒通過，錯誤訊息最多 5 則、每則最多 300 字（`sanitize-result.ts`）。
- **迴圈保護**（`guard-loops.ts`、`iframe-runner.js` 的 `__vlLoop`）：組 `srcdoc` 時，用語法解析器（acorn）把學習者的 `script.js` 和 `index.html` 裡直接寫的 `<script>` 裡的每個迴圈（`while`、`do…while`、`for`、`for…in`、`for…of`）改寫成每跑一圈先呼叫一次 `__vlLoop()`；沒有大括號的本體會補上大括號。`__vlLoop` 在同一個任務（一次不間斷的執行，中間沒讓出給瀏覽器）裡累計超過 1 秒，就丟出「迴圈跑太久了，已經中止…」的錯誤，所以：預覽和檢查不會卡住，`noError` 會看到這個錯誤，畫面會顯示專用的訊息。語法有錯的程式照原樣交出去（本來就跑不起來）。任務結束的訊號用 `MessageChannel`（背景分頁裡的 `setTimeout` 會被拉長）。**練習的標準答案不要寫一次跑超過 1 秒的迴圈。**
- **為什麼要有迴圈保護**（2026-10-20 在 Playwright 的 Edge 實測）：沒辦法從網頁裡中止一個卡住的沙箱 iframe；把它從 DOM 拿掉，跑它的瀏覽器程序還是一直吃 CPU，要關掉分頁才會停；**而且同一頁所有 `sandbox` 的 `srcdoc` iframe 共用同一個程序**（直接量過：加 3 個沙箱 iframe，renderer 程序只多 1 個；其中一個卡住，就是那一個程序在吃 CPU）：一個練習卡在無窮迴圈，同一頁其他練習的預覽也都沒有回應，之後新建的 iframe（包含所有「檢查」）也一樣，換新的 iframe、先拿掉舊的再建新的都救不了，只有重新整理頁面才會恢復。有了迴圈保護，一般的無窮迴圈一秒內就被中止，不會發生這些事。
- **預覽的更新和看門狗**：預覽每次更新都換一個新的 iframe（`key`），不在同一個 iframe 上換 `srcdoc`。父頁每秒對預覽 iframe 送一次 `ping`（`{ source: 'vibe', type: 'ping' }`），載入完成的頁面回 `ready`；5 秒內沒有回，就顯示「預覽沒有回應」和「重新整理頁面」按鈕。伺服器端渲染的 iframe 在元件啟動之前就載入完了，錯過它自己送的 `ready`，所以要靠 `ping`。
- **已在 Chromium 實測**（2026-10-19、20，T-009）：沙箱裡的程式碰 `parent.document`、`localStorage`、`document.cookie`、`top.location` 全部丟 `SecurityError`；`fetch`（含 `no-cors`）和 XMLHttpRequest 連外部網址都被擋住；沒有迴圈保護時，預覽 iframe 跑 `while (true) {}`，父頁計時器的最大延遲只有 63 毫秒（設定的間隔是 50 毫秒），所以父頁和編輯區不受影響。Firefox 和 Safari 還沒測。
- **已知限制**：(1) 學習者的程式和執行器在同一個 iframe：可以偽造「通過」或關掉迴圈保護，只影響學習者自己，第一版接受。(2) 迴圈保護攔不到的卡住（不是迴圈造成的，例如正規表示式的災難性回溯 `/(a+)+b/`）還是會讓同一頁所有沙箱 iframe 卡死、一直吃 CPU：父頁、編輯區、按鈕不受影響，會看到「預覽沒有回應」的提示；「重新整理頁面」可以恢復，但存檔的程式碼會被還原回來，所以要先改好程式碼再重新整理。(3) 迴圈保護只認得 JavaScript 的迴圈語句，遞迴不用管（會丟堆疊溢位的錯誤）。
- 之後可以加（不在第一版）：把學習者的 `console.log` 顯示在預覽下面。

## B4. 模擬伺服器（api）

- 執行器在 iframe 裡蓋掉 `window.fetch`：依 `method` 和 `path` 找路由，支援 `/prompts/:id` 這種寫法；組出 `Response`（`ok`、`status`、`json()`、`text()`、`headers`）；`delayMs` 用 `setTimeout` 模擬；沒對到就回 404 和 `{ "error": "Not Found" }`。
- 網址的來源（`https://…`）會被忽略，只看 `path` 和查詢字串。只支援 `fetch`。
- 每個請求記成 `{ method, path, query, body, status }`，傳回父頁顯示成「請求紀錄」，也給 `request` 檢查用。`bodyIncludes` 只比對你寫出的欄位（淺層，數字和字串嚴格比對）。

## B5. SQL 執行（T-015）

- **引擎**：建議 sql.js（SQLite 編譯成 WebAssembly），由 T-015 決定。限制：不能需要特殊的 HTTP header（GitHub Pages 設不了）；WASM 檔的路徑要跟著網站的 `base`。
- **在 Web Worker 裡執行**，單次上限 3 秒，超過就終止 Worker 並提示。
- 每次「執行」和「檢查」都從乾淨的資料庫開始：先跑 `setup`，再跑學習者的 SQL。不保存資料庫（重新整理就重來）。
- 學習者的 SQL 可以有多個語句：依序執行；顯示**最後一個會回傳資料列的語句**的結果（表格，最多 100 列）。
- `rows`：拿上面那個結果和 `equals` 比；沒有任何語句回傳資料列就算沒通過。`state`：全部執行完之後，再執行 `query` 來比。比對規則見 3.3（預設不管順序，當成多重集合比）。
- 出錯時：顯示 SQLite 的錯誤訊息和 `errorHint`，所有檢查都算沒通過，只顯示錯誤。
- 資料表面板：列出 `setup` 建立的每張表的欄位和前幾列，讓學習者知道有哪些資料可以查。

## B6. 測驗元件（T-010）

- 全部題目一次列在頁面上；點選項就立刻看到那個選項的 `explain`。答錯可以再選別的選項。
- **計分**：第一次點就點對才得 1 分；顯示「第一次就答對 X／N 題」。
- 選項順序在載入時打亂；進度裡用「選項在檔案裡的原始位置」記錄，所以重新整理或打亂都不影響。
- 每一題最後都答對，這份測驗就算完成。

## B7. 進度儲存與事件（T-009、T-010）

放在 `src/lib/`（單一模組，所有 island 共用同一份），並掛到 `window.vibeLearn`，讓不是模組的程式（外殼、問 AI）也能用。

- localStorage 的 key：`vibe-learn:progress`。讀寫都包 `try/catch`；用不了（無痕模式等）就退回只存在記憶體，不能丟例外。
- 格式（`schema` 是這份儲存格式自己的版本）：

```ts
interface ExerciseProgress {
  status: 'todo' | 'attempted' | 'passed' | 'revealed';
  attempts: number;              // 按「檢查」的總次數
  failedAttempts: number;        // 其中沒通過的次數（滿 3 次就可以看答案）
  hintsShown: 0 | 1 | 2 | 3;
  revealShown: boolean;          // 按過「看答案」
  files: Record<string, string>; // 學習者改過的程式碼，只存可編輯的檔案；sql 類型用 { query: '…' }
  lastFailedCheck?: { id: string; hint: string };
  updatedAt: string;             // ISO 時間
}
interface QuizProgress {
  answers: Record<string, { firstTryCorrect: boolean; tries: number; done: boolean }>;
}
interface ProgressState {
  schema: 1;
  lessons: Record<string, { exercises: Record<string, ExerciseProgress>; quiz?: QuizProgress }>;
}
```

- 只存學習者碰過的練習（編輯、檢查、看提示、看答案、重設），沒碰過的不留一筆空資料。
- **API**：`getProgress()`、`getExercise(id)`、`updateExercise(id, patch)`、`updateQuiz(lessonId, questionId, patch)`、`subscribe(listener)`（回傳取消訂閱的函式）、`reset()`。有改動時，也在 `window` 上送出 `CustomEvent('vibe:progress', { detail: state })`；用 `storage` 事件讓不同分頁同步。
- **一課完成**：課文 frontmatter `exercises` 裡每個練習都是 `passed` 或 `revealed`，而且測驗每題都 `done`。整體進度 = 已完成的課數 ÷ 正式上線的課數。
- **側邊欄「學習進度」**：版面和接口由 Claude-A 的外殼決定（`src/components/layout/README.md`：更新 `[data-vl-progress-count]`、`[data-vl-progress-fill]`，完成的課程連結加 `data-vl-done="true"`）。側邊欄在每個課程頁都有，所以更新程式要在每一頁執行，不能只放在有練習的頁面：由進度元件的 `src/components/progress/sidebar-progress.ts` 負責，`Sidebar.astro` 只要有一行 `<script>import '../progress/sidebar-progress';</script>`。它從 `nav.sidebar a` 的網址（`/lessons/lesson-N/`）取出 `N` 對應到 `lesson-N`；總課數用 `[data-vl-progress]` 的 `data-vl-total`。
- 第 2、3 課還沒做好時，檔案維持 `draft: true`：正式網站的側邊欄不會出現，`data-vl-total` 也只算已上線的課；首頁用卡片預告。

## B8. 問 AI 的對外介面（T-013 會用）

`window.vibeLearn.getContext()` 回傳目前這一頁的內容和學習者的狀態：

```ts
interface LessonContext {
  lessonId: string;              // 例如 'lesson-1'
  title: string;
  text: string;                  // 課文的純文字
  activeExerciseId?: string;     // 學習者最後操作（編輯、檢查、看提示）的練習；還沒碰過任何練習就省略
  exercises: Array<{
    id: string;                  // 'lesson-1/ex-1'
    type: 'preview' | 'api' | 'sql';
    goal: string;
    status: 'todo' | 'attempted' | 'passed' | 'revealed';
    hintsShown: 0 | 1 | 2 | 3;   // 已經展開到第幾層提示
    files: Record<string, string>;                    // 學習者目前的程式碼（含唯讀的檔案，AI 才看得懂整個頁面）
    lastFailedCheck?: { id: string; hint: string };   // 最近一次沒過的檢查
  }>;
}
```

- `activeExerciseId` 讓 AI 知道學習者現在問的是哪一題；`hintsShown` 讓 AI 的提示可以從下一層開始，不重複學習者已經看過的（Claude-A 在 M-031 的建議）。

- `text` 取自課文區（`.sl-markdown-content`）的文字，段落、標題、清單、程式碼區塊之間會換行；排除有 `data-no-context` 屬性的元素（整個練習區、標準答案），也排除 `script`、`style`、`svg`、`iframe`、`textarea`、`button`、螢幕閱讀器專用的 `sr-only` 和標題旁的錨點連結。標準答案、還沒展開的提示、測驗的正確答案，在學習者主動展開之前根本不放進 DOM；已展開的部分，由 T-013 決定要不要給 AI（預設不給）。
- `exercises` 只含已經載入的練習（練習用 `client:visible`，捲到才載入），而且是即時的（練習元件載入後登記自己，學習者剛打的字也看得到，不用等存檔）。
- `lessonId` 從網址 `/lessons/lesson-N/` 取；不在課程頁時（例如開發用的 `/dev/lab/`），改用第一個練習 id 的前綴。
- 除了 `window.vibeLearn.getContext()`，也可以直接 `import { getContext } from '../../lib/learn-context'`，是同一份。
- 伺服器端怎麼組 prompt、檢查哪些欄位，由 T-013 決定；這裡只保證資料的形狀。

## B9. 建置檢查（三個指令）

由 T-009、T-010 實作，放在 `src/lib/`。`package.json` 加指令的那幾行，由我在自己的 branch 改（Claude-A 在 M-031 同意）；`deploy.yml` 要加檢查步驟時，由 Claude-A 改。

**`npm run check:content`**：靜態檢查，幾秒跑完，部署前在 CI 執行，失敗就不上線。

1. 所有內容檔通過 `schemas.ts`，`contract` 等於 `CONTRACT_VERSION`；`id` 等於檔案路徑。
2. `lessons/` 底下的課文，必填欄位都有；檔名是 `lesson-N.mdx` 而且 `N` 等於 `lesson`；`sidebar.order` 等於 `lesson`。
3. `exercises`、`quiz` 指到的檔案都存在，並且和課文裡的 `<Exercise id>`、`<Quiz id>` 一一對應；課文裡每個 `<Diagram name>` 指到的 SVG 檔也要存在。
4. `draft: false` 的課，`gates` 三項都是 `true`。
5. 圖解：能被 XML 解析、有 `viewBox`（寬 320～480）、有 `<title>`；沒有寫死的顏色（`style` 以外的 `fill`、`stroke` 不是 `none`／`url(#…)`；`style` 裡先去掉 `var(…)`，剩下的沒有 `#hex`、`rgb()`、顏色名稱）；沒有 `<script>`、`<style>`、`<foreignObject>`、`<image>`、`on…` 屬性、外部連結。
6. 測驗：每題剛好一個正確答案（schema 已檢查）。

**`npm run test:exercises`**：要開瀏覽器跑練習，merge 前在本機執行。

- **練習自我測試**：用真正的檢查執行器跑每個練習；標準答案要通過全部檢查，起始內容要至少一條沒通過。preview、api 要在真的瀏覽器裡跑（用 Playwright，因為 `style` 檢查要靠瀏覽器算出實際樣式）：本機用 `channel: 'msedge'`（Windows 內建的 Edge，不用另外下載瀏覽器），GitHub Actions 的 ubuntu 用 `channel: 'chrome'`（Claude-A 的建議，實作時再確認）。sql 在 Node 裡用 sql.js 就能跑。

**`npm run test:schemas`**（已經有了）：跑 `src/lib/schemas.test.ts`。約定文件裡的範例都要通過 schema，故意寫錯的版本都要被擋下。改約定文件或 `schemas.ts` 之後，要先跑它。

人工才能檢查的（術語有沒有附中文、來源網址是不是真的、寫得好不好），列在審查清單裡，不在這裡。

## B10. 效能與手機

- 練習和測驗元件用 `client:visible`，捲到才載入。第一版不引入大型編輯器。
- 每課頁面的 JavaScript（不含 sql.js 和 WASM）目標 100 KB 以內（壓縮後）；sql.js 和 WASM 只在 SQL 練習進入畫面時才載入。
- 所有按鈕在手機上至少 44 px 高；預覽區和編輯區上下排列。
- 迴圈保護用的語法解析器 acorn，打包後約 113 KB、壓縮後約 34 KB，包在練習元件（preview、api）裡，所以只有有這種練習的頁面才會載入。實測（2026-10-20）：有練習的頁面，JavaScript 合計約 85 KB（壓縮後，含網站本身的 JavaScript），在 100 KB 的目標內；之後加測驗和進度元件時要留意剩下的 15 KB。

## B11. 預設做法（待 Claude-A 和使用者確認）

這些是我先照規格書選的預設，要改的話，改約定就好：

1. 「看答案」在三層提示都看過或失敗滿 3 次之後才出現。
2. 測驗只算「第一次就答對」；答錯會看到那個選項的說明，可以再選。
3. 一課完成 = 全部練習 `passed`／`revealed` 加上測驗全部答完。
4. preview 改程式後自動更新；api、sql 要按「執行」。
5. 「三道關卡都過才上線」用 Starlight 的 `draft` 加上 `gates` 實作，`check:content` 在部署前把關。
6. 課文檔名用 `lesson-N.mdx`，和外殼放的佔位頁一致（T-010 直接用正式內容覆蓋，網址 `/lessons/lesson-N/` 不變）；課號一律不補零。
7. 還沒做好的課維持 `draft: true`，不放「準備中」佔位頁在 `lessons/` 底下（`check:content` 才能對每個檔案一致地檢查）。
8. 課名有兩套（規格書第 4 節，和首頁、佔位頁用的名稱），待統一；範例暫用首頁的名稱。

## 怎麼改這份約定

1. 任何成員在討論區提出要改什麼、為什麼。
2. Claude-B（約定的負責人）在 branch 上同時改本文件和 `src/lib/schemas.ts`，由 Claude-A 審。
3. 只新增可省略的欄位：版本寫成 1.1、1.2…，內容檔不用動。不相容的改動（改名、刪欄位、改意義）：`CONTRACT_VERSION` 加一，`check:content` 會列出所有還在用舊版的檔案。
4. 在討論區發一則「約定更新」，寫清楚改了什麼；給 Gemini 的內容一律附最新版的第一部分。

## 變更紀錄

| 版本 | 日期 | 內容 |
|---|---|---|
| 1.0 草稿 | 2026-10-18 | 第一版：課程檔、練習（preview、api、sql）、測驗、圖解、進度與事件、建置檢查 |
| 1.1 | 2026-10-19 | 照 T-009 的實測補充，都是補充或釐清，內容檔不用改：沙箱安全規則在 Chromium 的驗證結果、逾時的處理（逾時也算沒通過；沒有 steps 的 case 逾時，後面的 case 直接失敗）、`attr` 的空白處理和 `present: false`、進度儲存多了 `failedAttempts`、`revealShown`、`lastFailedCheck` 和 `getExercise`、`getContext()` 的細節 |
| 1.1.1 | 2026-10-20 | T-009 收尾，都是實作備忘（第二部分）的補充，內容檔不用改：迴圈保護（同一頁的沙箱 iframe 共用一個瀏覽器程序，一個卡住整頁都壞掉，所以要在執行前中止無窮迴圈）、預覽每次更新換新的 iframe 和看門狗（ping）、結果驗證、探針用完拿掉、style 檢查不要用百分比、<Diagram> 的無障礙屬性放在內層、已知限制 |
