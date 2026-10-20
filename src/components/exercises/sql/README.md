# T-015a SQL 執行核心

基準 main `45c0b78`；規格為約定 3.3、B5 和 M-035、M-069。
只含執行核心，不含畫面、提示或進度。T-009c 由 Claude-A 另行串接。

## 入口

瀏覽器使用 `run.ts`；Node 使用 `run.node.mjs`（供測試與 T-009c）。
兩者提供相同的三個函式，型別在 `types.ts`，`SqlExercise` 取自共用
`schemas.ts` 的 `Exercise`，不複製 schema：

```ts
runSql(setup, learnerSql)              // Promise<SqlRunResult>
checkSqlExercise(exercise, learnerSql) // Promise<SqlCheckResult>
describeTables(setup)                 // Promise<SqlTable[]>
```

前兩個函式回傳 `ok`、`error` 或 `timeout`。出錯保留 SQLite 訊息；
批改出錯或逾時時，依原 checks 順序回傳全部 `passed: false`，
不保留部分成功或誤導性的結果表。

`describeTables` 的約定回傳型別只有陣列，所以出錯時 **reject**：
`SqlExecutionError` 或 `SqlTimeoutError`，呼叫端應 catch；
不能把載入／SQL 錯誤當成「沒有資料表」。列出主資料庫的使用者表，
排除 `sqlite_` 系統表；包含空表、欄位與前 5 列。未排序資料不保證列序。

## 執行與比對

- 每次呼叫建立新的 Worker 和記憶體資料庫，先跑 setup。
  成功、錯誤、逾時都終止 Worker；Node 等待 terminate 完成才回傳。
- Worker 先載入 sql.js（含 WASM），完成後送出 `ready`；接著執行 setup、
  學習者 SQL 與檢查，最後送出 `result`。3 秒從收到 `ready` 起算，所以
  慢網路下載 WASM 的時間不會被算成「SQL 執行太久」。超時直接終止整個
  Worker；不依靠 SQL 主動停止。
- 載入階段另有 20 秒上限（`LOAD_TIMEOUT_MS`）：超過回 `error`（訊息
  「SQL 引擎載入逾時…」），不是 `timeout`，因為不是學習者的 SQL 太慢。
  沒有這一段，頻寬低到 3 秒下載不完 WASM 的連線永遠跑不出 SQL：每次
  都在 3 秒被終止，下載被中斷、也不會進快取。
- 透過 sql.js `iterateStatements` 依序準備與執行，不能用分號切 SQL。
  每個語句執行到底，含 RETURNING，最後取有欄位的結果集；
  零列的 SELECT 仍算結果集，UPDATE 等沒有結果集的語句不覆蓋它。
- 表格最多 100 列；額外列只計數，按需要保留批改用的列。
  `truncated` 只有超過 100 列才是 true，批改不會把截短表格當完整答案。
- 比對保留型別、大小寫、空白、null 和重複列。預設多重集合比對，
  `ordered: true` 才比列序；`columns` 按欄名及順序完全比對。
  `state` 在學習者所有語句完成後才執行 query。
- 課程的 Cell 限文字、數字與 null；保留的結果列遇到 BLOB 回傳明確錯誤。
  SQLite 64 位整數經 sql.js 轉成 JavaScript number，超出安全整數範圍
  不保證精度；本版課程資料應使用安全範圍數字。

## Worker 和 WASM

`run.ts` 使用 Vite 的 Worker URL 與 `sql.js/dist/sql-wasm.wasm?url`；
以 `import.meta.env.BASE_URL` 為基準解析資產 URL，不重複加 base，
也不從 CDN 下載。正式建置會輸出有雜湊名稱的 WASM 和 Worker。
只有呼叫函式才建立 Worker／載入 WASM。

瀏覽器與 Node Worker 共用 `engine.mjs` 和 `client.mjs`。
sql.js 1.15.1 的 browser export 不依賴 Node fs，Node 入口則使用
套件內附的本機 WASM。無需 SharedArrayBuffer 或特殊 HTTP header。

目前正式頁面尚未匯入 SQL 入口，因此一般 `astro build` 不會把
未使用的 SQL 資產放進 dist；T-015 接上入口後才會輸出。
下面的獨立測試入口可驗證真正的瀏覽器打包與子路徑載入。

## 驗證與審查對照

在此 worktree 根目錄執行：

```sh
npm run test:sql
npm test
npm run check
npm run build
node src/components/exercises/sql/browser-smoke.mjs
```

| M-069 | 自動驗證 |
|---|---|
| 1 比對 | 數值／文字／null、欄名大小寫與順序、多重集合重複列、ordered、空 SELECT 與無結果、state |
| 2 多語句 | DDL 後再查新表、字串內分號、最後 SELECT、100／101／130 列、RETURNING 完整寫入 |
| 3 錯誤／逾時 | 語法／欄位／後段語句／setup／state query 錯誤；無窮遞迴約 3 秒 timeout，下一次成功；Worker 啟動／傳送／退出清理；ready 之後才起算 3 秒、載入另有 20 秒上限、格式不對的訊息（`client.test.mjs`，假計時器） |
| 4 隔離 | DELETE 後再次呼叫與同時呼叫，皆拿到乾淨的 setup 資料 |
| 5 資料表 | 多表、空表、含引號表名、前 5 列、排除系統表但保留 sqliteX |
| 6 WASM | 獨立 Vite 正式打包後，在 Edge 的 /Gm-use/ 驗證 WASM HTTP 200、查詢、錯誤、逾時與恢復 |
| 7 練習 | 從 CONTRACT.md 讀真實 lesson-3/ex-1 YAML，加 4 個自製練習；每份先過共用 schema，標準答案全過、起始內容未過 |

`browser-smoke.mjs` 使用 Astro 實際依賴的 Vite、既有 Playwright 和系統
Edge，建立獨立的無頭瀏覽器，不使用個人登入資料。輸出只放在本工作區
`node_modules/.cache/sql-smoke/`，結束會關閉瀏覽器／伺服器並清除當次產物。
不納入 npm test，也不改正式頁面或部署。Claude-B 已依 M-069 用臨時
Astro 頁與 astro preview 獨立審查（結果見 `team/drafts/review-t015a.md`）；
本測試只驗證獨立的 Vite 入口，不取代正式頁面接上後的驗收。

參考：[sql.js](https://github.com/sql-js/sql.js)、
[Vite 資產與 Worker](https://vite.dev/guide/assets.html)。
