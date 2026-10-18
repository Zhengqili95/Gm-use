# vibe-learn 協作規則

這份是所有 AI 成員的共同規則。Codex 會自動讀這份檔案；Claude 透過 `CLAUDE.md` 匯入它。

## 專案是什麼

免費的 AI 時代學習平台。參考哈利（科技浪）「氛圍學院」的形式：互動練習、個人化學習。課程內容全部自己做。
規格寫在 `docs/SPEC.md`（還在定，見任務 T-001）。

## 成員

| 代號 | 是誰 | 能不能改檔案 | 備註 |
|---|---|---|---|
| 使用者 | 專案負責人 | — | 所有決定由使用者拍板 |
| Claude-A | Claude Code（主帳號） | 可以 | 這一輪的討論主持人 |
| Claude-B | Claude Code（第二個帳號） | 可以 | |
| Codex | OpenAI Codex App | 可以 | |
| Gemini | Google Gemini App | 不行 | 由使用者轉貼訊息 |

不知道自己是哪個代號時，先問使用者，不要自己猜。

第一版的主要製作由 Claude-A、Claude-B 負責，大型以上的任務都交給這兩位；Codex 的額度消耗太快，只負責中型任務（D-009、D-010）。任務大小的定義見任務表。

## 共用檔案在哪裡

討論用的檔案只有一份，放在主資料夾：

```
D:\02_開發與專案\鳴潮用\vibe-learn\team\
```

- `team/` 不進 git（寫在 `.gitignore`），所以 worktree 裡不會有這個資料夾。
- 在 worktree 裡工作時，一律用上面的絕對路徑讀寫 `team/`。

| 檔案 | 用途 |
|---|---|
| `team/BOARD.md` | 討論區 |
| `team/TASKS.md` | 任務表 |
| `team/DECISIONS.md` | 定案紀錄 |

## 每次開工的步驟

1. 讀這份 `AGENTS.md`。
2. 讀 `team/DECISIONS.md`。
3. 讀 `team/TASKS.md`，找自己負責的任務。
4. 讀 `team/BOARD.md` 最後幾則，找寫給自己代號或 `@全體` 的留言。
5. 讀 `docs/SPEC.md`。
6. 先用一兩句話告訴使用者你看到什麼、接下來要做什麼，再動手。

完成一件事後：更新 `team/TASKS.md` 的狀態，並在 `team/BOARD.md` 發一則簡短回報。

## 討論區規則（team/BOARD.md）

- 只能加在檔案最後面。不改、不刪任何留言，包括自己的舊留言；要更正就新增一則。
- 寫之前重新讀一次檔案，用下一個編號。
- 格式：

  ```
  ### [M-編號] YYYY-MM-DD HH:mm · 寄件者 → 收件者
  **主題**：…
  （內容）
  **需要回覆**：誰、什麼（沒有就寫「無」）
  ```

- 回覆別人時，在內容第一行寫「回覆 M-編號」。
- 意見要具體。可以反對別人，但要說理由，不要只附和。
- 需要 Gemini 的意見時：發一則寄給 Gemini 的留言，並幫使用者把要貼給 Gemini 的內容整理成一段。Gemini 讀不到檔案，所以要附上必要的背景。
- 使用者貼回 Gemini 的回覆時，照原文記錄，寄件者寫「Gemini（使用者轉貼）」，不要改寫內容。
- Gemini 的整課草稿例外，不貼進討論區：收到的成員把原文存成 `team/drafts/gemini-第N課.md`（同一課有新版本時加上 `-v2`、`-v3`），討論區只記一則通知，寫檔名和一句摘要（D-012）。
- 使用者在對話中回應了討論區的提問時，由收到回應的 AI 代為記錄一則，寄件者寫「使用者（由 代號 記錄）」，內容第一行寫「回覆 M-編號」。

## 觀察房（tools/observer/）

使用者用觀察房即時看討論區、任務表、定案紀錄和規格書，網址是 http://127.0.0.1:5180（只能看，不能發言）。觀察房照這份檔案規定的格式讀檔案，所以：

- 討論區的標題列、`**主題**：`、`**需要回覆**：`，還有任務表的欄位順序，都不要改格式。
- 「需要回覆」裡要寫出成員代號（例如 Claude-B、Codex），觀察房才知道誰還沒回。
- 回覆時一定要在內容寫「回覆 M-編號」，觀察房才會把你從「待回覆」裡拿掉。
- 要取消對某位成員的回覆要求時（例如使用者改了分工），在新留言裡加一行 `**取消回覆**：成員代號：M-編號、M-編號`，多位成員用「；」隔開。觀察房會把這些項目從待回覆裡拿掉。

## 任務表規則（team/TASKS.md）

- 每個任務只有一個負責人，並寫清楚負責路徑（可以改哪些檔案或資料夾）。
- 認領任務：填上負責人、把狀態改成「進行中」，並在討論區發一則留言。
- 狀態只用這五種：待開始、進行中、待審查、完成、卡住。
- 不可以改別人負責路徑裡的檔案；需要改就在討論區提出。

## 決定權

- 只有使用者能做決定。AI 可以提案、可以反對，但 AI 之間的共識或投票都不算定案。
- 使用者同意後，才把決定寫進 `team/DECISIONS.md`，註明日期和使用者的原話或重點。
- 不可以修改或刪除 `team/DECISIONS.md` 的舊紀錄。覺得某項決定有問題，就在討論區提出。

## Git 規則

- **討論階段**：直接在主資料夾工作，只改 `team/` 和 `docs/`。
- **寫程式階段**：每個成員用自己的 worktree 和 branch。branch 名稱用 `<代號小寫>/<任務編號>-<簡短說明>`，例如 `codex/t-012-quiz-runner`。
- 不直接 commit 到 `main`。merge 前要有另一位成員審查，並且經過使用者同意。
- 不 force push、不改 git 設定、不刪別人的 branch。
- commit 訊息用英文。

## 網站開發（Astro + Starlight）

- 第一次在專案根目錄（或自己的 worktree）執行 `npm install`。
- 本機預覽：`npm run dev`，網址是 http://localhost:4321 。不能一直佔著終端機的工具，可以改用 `npx astro dev --background`，再用 `npx astro dev status`、`npx astro dev logs`、`npx astro dev stop` 管理。
- 正式建置：`npm run build`，輸出到 `dist/`。合併到 `main` 前，`npm run build` 一定要成功。
- 課程頁放在 `src/content/docs/lessons/`，側邊欄的「課程」群組會自動產生；元件放在 `src/components/` 底下自己負責的資料夾。
- 側邊欄「學習進度」區塊的接口，寫在 `src/components/layout/README.md`。
- 官方文件：Astro https://docs.astro.build 、Starlight https://starlight.astro.build 。寫法以這兩份文件和 `node_modules` 裡實際安裝的版本為準，不要憑記憶。

## Skill

本專案放了四個 skill，內容兩份相同：Claude 用 `.claude/skills/`，Codex 用 `.agents/skills/`。改其中一份時，要同步另一份。

| skill | 用途 | Claude 怎麼用 | Codex 怎麼用 |
|---|---|---|---|
| `grilling` | 訪談使用者，把計畫或規格問清楚 | `/grilling`，或使用者說「grill」時自動使用 | `$grilling` |
| `grill-me` | `grilling` 的入口 | `/grill-me` | 不適用（它要呼叫 Claude 才有的工具），請直接用 `$grilling` |
| `frontend-design` | 設計畫面 | 做畫面時自動使用，或 `/frontend-design` | `$frontend-design` |
| `diagnosing-bugs` | 有系統地除錯 | 回報 bug 時自動使用，或 `/diagnosing-bugs` | `$diagnosing-bugs` |

來源（2026-10-18 下載，未修改）：

- `grill-me`、`grilling`、`diagnosing-bugs`：[mattpocock/skills](https://github.com/mattpocock/skills) @ `49dd158d1076`，MIT 授權
- `frontend-design`：[anthropics/skills](https://github.com/anthropics/skills) @ `dbd4588f9e10`，Apache-2.0 授權

## 基本原則

- 平台要讓學習者免費使用。任何會產生費用的設計（例如 AI 助教呼叫付費 API）都要先在討論區提出，由使用者決定。
- 課程內容、名稱和品牌都自己做，不複製哈利或氛圍學院的課程內容。
- 給使用者的回覆用繁體中文，開發用語可以保留英文；程式碼、識別名稱、commit 訊息用英文。
- 不確定的事實先查證，查不到就說不知道。
