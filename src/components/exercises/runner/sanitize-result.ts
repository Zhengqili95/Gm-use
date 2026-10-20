// 檢查執行器傳回來的結果，父頁不能照單全收：學習者的程式和執行器在同一個 iframe 裡，什麼訊息都可能送出來（docs/CONTRACT.md B3）。
// 只接受這個 case 的檢查 id；格式不對、或沒回報的檢查算沒通過；錯誤訊息限制數量和長度。
// 這個檔案不碰 DOM，所以可以直接用 Node 測。
const MAX_ERRORS = 5;
const MAX_ERROR_LENGTH = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeResult(
  data: unknown,
  checkIds: readonly string[],
): { results: Array<{ id: string; passed: boolean }>; errors: string[] } {
  const message = isRecord(data) ? data : {};
  const allowed = new Set(checkIds);
  const reported = new Map<string, boolean>();
  if (Array.isArray(message.results)) {
    for (const item of message.results) {
      if (!isRecord(item) || typeof item.id !== 'string' || !allowed.has(item.id) || typeof item.passed !== 'boolean') continue;
      if (!reported.has(item.id)) reported.set(item.id, item.passed); // 同一條回報兩次，以第一次為準
    }
  }
  const errors = Array.isArray(message.errors)
    ? message.errors
        .filter((error): error is string => typeof error === 'string')
        .slice(0, MAX_ERRORS)
        .map((error) => error.slice(0, MAX_ERROR_LENGTH))
    : [];
  return { results: checkIds.map((id) => ({ id, passed: reported.get(id) === true })), errors };
}
