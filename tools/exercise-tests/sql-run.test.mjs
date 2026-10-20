// SQL 練習那條路的端到端測試：真的執行 run.mjs，但只跑 SQL 的 fixtures，所以不用開瀏覽器，可以放進 npm test（M-083 建議 2）。
// 要開瀏覽器的整組自我檢查在 self-check.mjs。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

test('SQL 練習在 Node 裡跑，不會去開瀏覽器', () => {
	const result = spawnSync(
		process.execPath,
		[join(here, 'run.mjs'), '--dir', join(here, 'fixtures'), 'lesson-3/ex-1', 'lesson-3/ex-2', 'lesson-3/ex-3'],
		{
			encoding: 'utf8',
			timeout: 60_000,
			windowsHide: true,
			// 故意給一個不存在的瀏覽器：只有 SQL 時如果還去開瀏覽器，這個測試就會失敗
			env: { ...process.env, EXERCISE_TEST_BROWSER: 'no-such-browser' },
		},
	);
	assert.equal(result.error, undefined, String(result.error));
	const lines = result.stdout.trim().split(/\r?\n/);
	assert.deepEqual(lines.slice(0, 3).map((line) => line.split('  ')[0]), ['✓ lesson-3/ex-1', '✗ lesson-3/ex-2', '✗ lesson-3/ex-3']);
	assert.match(lines[2], /程式錯誤：.*syntax error/);
	assert.equal(lines.at(-1), '通過 1 個、沒過 2 個、略過 0 個');
	assert.equal(result.status, 1, result.stderr);
});
