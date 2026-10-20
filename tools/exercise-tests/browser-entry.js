// 在瀏覽器裡執行的部分：直接用練習元件真正在用的檢查執行器（run-checks.ts），
// 由 bundle.mjs 用 Vite 打包成一個檔案，再由 Playwright 載入空白頁。
import { runChecks } from '../../src/components/exercises/runner/run-checks';

// Map 傳不出瀏覽器，換成一般物件
export async function runForTest(files, checks) {
	const outcome = await runChecks(files, checks);
	return { passed: Object.fromEntries(outcome.passed), errors: outcome.errors, timedOut: outcome.timedOut };
}
