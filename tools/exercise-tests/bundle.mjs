// 用 Vite 把 browser-entry.js（和它用到的檢查執行器）打包成一段可以直接放進頁面的程式。
// run-case.ts 用 `?raw` 匯入 iframe-runner.js，只有 Vite 看得懂，所以不能直接在 Node 執行。
// Vite 是 Astro 帶進來的，不用另外安裝。
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
export const GLOBAL_NAME = 'vibeExerciseTests';

export async function bundleRunner() {
	const result = await build({
		configFile: false,
		root: resolve(here, '..', '..'),
		logLevel: 'silent',
		publicDir: false,
		build: {
			write: false,
			minify: false,
			lib: { entry: join(here, 'browser-entry.js'), formats: ['iife'], name: GLOBAL_NAME },
		},
	});
	const outputs = Array.isArray(result) ? result : [result];
	const chunk = outputs[0]?.output?.find((item) => item.type === 'chunk');
	if (!chunk) throw new Error('打包檢查執行器失敗：Vite 沒有產出程式。');
	return chunk.code;
}
