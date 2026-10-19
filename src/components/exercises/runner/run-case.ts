// 父頁這一邊：開一個沙箱 iframe，等它說 ready，送出 steps 和 checks，收回結果（docs/CONTRACT.md B3）。
import type { Files, PageCheck, Step } from '../types';
import { buildSrcdoc } from './build-srcdoc';
import runnerSource from './iframe-runner.js?raw';

export interface CaseOutcome {
  results: Array<{ id: string; passed: boolean }>;
  errors: string[]; // 學習者的程式丟出的錯誤
  timedOut: boolean;
}

// 一個 case = 一次從頭載入的頁面：先做 steps，再判斷這些檢查
export function runCase(files: Files, steps: Step[], checks: PageCheck[], timeoutMs = 3000): Promise<CaseOutcome> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts'); // 不加 allow-same-origin、allow-forms、allow-modals、allow-popups
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.title = '檢查用的頁面';
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:480px;height:320px;border:0';

    let finished = false;
    function finish(outcome: CaseOutcome) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
      resolve(outcome);
    }

    const timer = setTimeout(
      () => finish({ results: checks.map((check) => ({ id: check.id, passed: false })), errors: [], timedOut: true }),
      timeoutMs,
    );

    function onMessage(event: MessageEvent) {
      // 沙箱 iframe 的來源是 "null"，沒辦法比對網址，所以用 event.source 確認是自己開的那個 iframe
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'vibe') return;
      if (data.type === 'ready') {
        iframe.contentWindow?.postMessage({ source: 'vibe', type: 'run', steps, checks }, '*');
      } else if (data.type === 'result') {
        finish({ results: data.results, errors: data.errors ?? [], timedOut: false });
      }
    }

    window.addEventListener('message', onMessage);
    iframe.srcdoc = buildSrcdoc(files, runnerSource);
    document.body.appendChild(iframe);
  });
}
