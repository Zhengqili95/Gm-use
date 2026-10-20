// 迴圈保護（docs/CONTRACT.md B3）：把學習者程式裡的每個迴圈，改寫成「每跑一圈，先呼叫一次 __vlLoop()」。
// __vlLoop 定義在 iframe-runner.js：一次不間斷的執行在迴圈裡跑太久，它就丟出錯誤，把迴圈中止。
//
// 為什麼需要：網頁沒辦法從外面中止一個卡在無窮迴圈的沙箱 iframe，而且同一頁所有沙箱 iframe 共用同一個瀏覽器程序，
// 一個卡住，整頁的預覽和「檢查」都會跟著卡死、一直吃 CPU，要重新整理頁面才會恢復（M-063 的實驗）。
//
// 做法：用語法解析器（acorn）找出迴圈，在迴圈本體最前面插入呼叫。只插入文字，不動其他地方，所以行號不變。
// 語法有錯的程式照原樣交出去：它本來就跑不起來，瀏覽器自己會報錯，不會有迴圈。
// 這個檔案不碰 DOM，所以可以直接用 Node 測。
import { parse } from 'acorn';

export const GUARD_FUNCTION = '__vlLoop';
// 迴圈被中止時，iframe-runner.js 丟出的錯誤訊息一定包含這段字（iframe-runner.test.mjs 會確認兩邊一致）；畫面靠它認出是迴圈保護
export const LOOP_ABORT_MARK = '迴圈跑太久了';

interface AstNode {
  type: string;
  start: number;
  end: number;
  body?: AstNode;
}

const LOOP_TYPES = new Set(['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement']);

export function guardLoops(source: string, sourceType: 'script' | 'module' = 'script'): string {
  let ast: unknown;
  try {
    ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowHashBang: true,
    });
  } catch {
    return source;
  }

  const edits: Array<{ at: number; text: string }> = [];
  const call = `${GUARD_FUNCTION}();`;

  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const node = value as AstNode;
    if (typeof node.type === 'string' && LOOP_TYPES.has(node.type) && node.body) {
      if (node.body.type === 'BlockStatement') {
        edits.push({ at: node.body.start + 1, text: call }); // { 的後面
      } else {
        // 沒有大括號的迴圈本體（while (x) y++;、for (;;);）：補上大括號，才放得進呼叫
        edits.push({ at: node.body.start, text: `{${call}` }, { at: node.body.end, text: '}' });
      }
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(ast);

  // 從後面往前插入，前面的位置才不會跑掉
  edits.sort((a, b) => b.at - a.at);
  let result = source;
  for (const edit of edits) result = result.slice(0, edit.at) + edit.text + result.slice(edit.at);
  return result;
}

// index.html 裡直接寫的 <script>…</script>（沒有 src）也要保護；script.js 另外處理
export function guardInlineScripts(html: string): string {
  return html.replace(/(<script\b([^>]*)>)([\s\S]*?)(<\/script>)/gi, (whole, open: string, attrs: string, code: string, close: string) => {
    if (/\bsrc\s*=/i.test(attrs)) return whole;
    const type = /\btype\s*=\s*["']?([^\s"'>]+)/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && type !== 'text/javascript' && type !== 'module') return whole; // 例如 application/json，不是程式
    return open + guardLoops(code, type === 'module' ? 'module' : 'script') + close;
  });
}
