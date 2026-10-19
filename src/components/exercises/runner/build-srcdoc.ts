// 組出沙箱 iframe 的 srcdoc（docs/CONTRACT.md B3）：內容安全政策、檢查執行器、學習者的程式。
import type { Files } from '../types';

// 沒有寫 connect-src，所以學習者的程式連不到任何外部網路
export const CSP =
  "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";

// 內容裡出現 </script>、</style> 會讓標籤提早結束，要跳脫
function escapeClosing(text: string, tag: 'script' | 'style'): string {
  return text.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
}

// index.html 用 <link href="style.css"> 和 <script src="script.js"> 參照另外兩個虛擬檔案，這裡把它們內嵌進去
export function buildBody(files: Files): string {
  let html = files['index.html'] ?? '';
  const css = files['style.css'];
  const js = files['script.js'];
  if (css !== undefined) {
    html = html.replace(/<link\b[^>]*\bhref=["']style\.css["'][^>]*>/i, () => `<style>${escapeClosing(css, 'style')}</style>`);
  }
  if (js !== undefined) {
    html = html.replace(
      /<script\b[^>]*\bsrc=["']script\.js["'][^>]*>\s*<\/script>/i,
      () => `<script>${escapeClosing(js, 'script')}</script>`,
    );
  }
  return html;
}

export function buildSrcdoc(files: Files, runnerSource: string): string {
  return [
    '<!doctype html>',
    '<html lang="zh-TW"><head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // 檢查執行器放在最前面，才抓得到學習者程式在載入時丟出的錯誤
    `<script>${escapeClosing(runnerSource, 'script')}</script>`,
    '<style>body { font-family: system-ui, sans-serif; line-height: 1.6; margin: 12px; }</style>',
    '</head><body>',
    buildBody(files),
    '</body></html>',
  ].join('\n');
}
