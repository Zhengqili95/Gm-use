# T-006 小驗證結果：用 `claude -p` 回答「問 AI」

- 日期：2026-10-18
- 執行者：Claude-A
- 環境：Windows 11、Claude Code 2.1.286、主帳號（claude.ai 訂閱登入）
- 模型：別名 `haiku`，實際用到的是 `claude-haiku-4-5-20251001`
- 腳本：`tools/ask/spike/spike.mjs`（會實際呼叫模型 4 次）

## 結論

**可以用。** T-013 建議直接沿用這組參數：

```
claude -p --output-format json --safe-mode --tools "" --strict-mcp-config
       --permission-mode dontAsk --permission-prompts none --no-session-persistence
       --model <模型> --append-system-prompt <助教規則> --json-schema <回答格式>
```

課程內容、練習程式碼和提問都從 stdin 傳進去；工作資料夾用一個空的暫存資料夾，避免讀到專案的 CLAUDE.md。

## 四項測試

| 測試 | 結果 | 時間 | 說明 |
|---|---|---|---|
| T1 預設設定 | 會載入全域 CLAUDE.md | 10.3 秒 | 回答最後自動附上「本次英文用語」表，代表使用者的全域規則會混進來 |
| T2 加 `--safe-mode` | 擋掉全域設定，登入照常 | 5.2 秒 | 沒有英文用語表；用的仍是 claude.ai 訂閱登入 |
| T3 沒有工具 | 讀不到檔案，暗號沒有外洩 | 5.8 秒 | 但模型會「假裝」呼叫工具：在文字裡寫出假的 function_calls，還編造「目錄是空的」；後半段混用簡體字 |
| T4 `--json-schema` | 拿到固定格式 | 12.8 秒 | `structured_output` 欄位有三層提示、完整答案和英文用語；內容正確，全程繁體 |

T4 的實際回答（練習題故意把 `color` 拼成 `colour`）：

- 提示 1：CSS 屬性名稱必須拼寫完全正確，否則瀏覽器無法認識這條規則。
- 提示 2：檢查你的程式碼中 `colour` 這個單字的拼寫，想想 CSS 應該用哪一種英文拼法。
- 提示 3：CSS 用美式英文拼寫，應該是 `color` 而不是 `colour`。
- 完整答案：附上修正後的程式碼，並解釋瀏覽器會忽略看不懂的屬性。

## 給 T-013 的注意事項

1. **一定要加 `--safe-mode`**：回答格式由平台自己的助教規則決定，不受使用者的全域設定影響。
2. **助教規則要明講沒有工具**：「你沒有任何工具，不能讀檔案、不能執行指令，只能根據提供的內容回答」，避免 T3 那種假裝呼叫工具、編造結果的情況。
3. **助教規則要明講只用繁體中文**：「只用繁體中文（台灣用語），不要用簡體字」。少了全域設定以後，haiku 會混用簡體字（T2、T3）。
4. **用 `--json-schema` 會比較慢**：答案在 `structured_output` 欄位（不是 `result`），而且要 2 個回合，大約 11～13 秒。畫面要有「思考中」的提示；之後可以評估改用 `--output-format stream-json` 逐字顯示。
5. **英文用語的例句要寫清楚**：回答格式裡要註明 `example` 是「英文例句」。T4 給的是中文句子。
6. **模型要明確指定**：別名 `haiku` 在這個版本對應到 Haiku 4.5，不是 Haiku 5.5。T-013 要明確指定回答用的模型，之後可以比較 haiku 和 sonnet 的品質和速度。
7. **費用欄位只是估計值**：JSON 裡的 `total_cost_usd` 是換算成 API 價格的估計。用訂閱登入時不會另外收費，但會算進 5 小時和每週的額度。
8. **Windows 可以直接執行**：Node 的 `spawn('claude', ...)` 不需要 shell，空字串參數（`--tools ""`）也能正確傳過去。

## 還沒驗證

- 串流輸出（`stream-json`）的逐字顯示。
- 額度用完、網路中斷時，錯誤訊息長什麼樣子。
- 本機伺服器的 Origin 檢查（屬於 T-013）。
