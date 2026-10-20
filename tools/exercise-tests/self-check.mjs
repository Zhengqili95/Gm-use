// test:exercises 的自我檢查：拿 fixtures/ 裡故意寫錯的練習去跑，確認它抓得到問題、不會卡住。
// 要開瀏覽器，所以不放進 npm test（檔名也故意不叫 *.test.mjs）。
// 用法：node --test tools/exercise-tests/self-check.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

function runOn(args) {
	const started = Date.now();
	const result = spawnSync(process.execPath, [join(here, 'run.mjs'), ...args], {
		encoding: 'utf8',
		timeout: 120_000, // 卡住的話在這裡停下來，測試會失敗，而不是一直等
		windowsHide: true,
	});
	return { ...result, seconds: (Date.now() - started) / 1000 };
}

test('故意寫錯的練習都抓得到，無窮迴圈也不會卡住整個測試', () => {
	const result = runOn(['--dir', join(here, 'fixtures')]);
	assert.equal(result.error, undefined, `執行失敗或超過 120 秒：${result.error}`);
	const lines = result.stdout.trim().split(/\r?\n/);
	const expected = [
		/^✗ lesson-1\/ex-1 {2}標準答案沒過：card-background$/,
		/^✗ lesson-1\/ex-2 {2}標準答案沒過：after-click（執行逾時）$/,
		/^✓ lesson-1\/ex-3 {2}標準答案全過；起始內容沒過：title-text（起始內容執行逾時）$/,
		/^✗ lesson-1\/ex-4 {2}起始內容就通過全部檢查/,
		/^✗ lesson-1\/ex-5 {2}格式不對：沒有 solution/,
		/^✗ lesson-1\/ex-6 {2}YAML 讀不懂：/,
		/^✗ lesson-1\/ex-7 {2}標準答案執行時出錯：.*documnet/,
		/^－ lesson-2\/ex-1 {2}略過：api/,
		/^－ lesson-3\/ex-1 {2}略過：sql/,
		/^✓ lesson-10\/ex-1 {2}標準答案全過；起始內容沒過：msg-text$/,
		/^$/,
		/^通過 2 個、沒過 6 個、略過 2 個（略過的不算通過）$/,
	];
	assert.equal(lines.length, expected.length, result.stdout);
	expected.forEach((pattern, index) => assert.match(lines[index], pattern));
	assert.equal(result.status, 1, '有練習沒過時要回傳 1');
	assert.ok(result.seconds < 60, `花了 ${result.seconds} 秒，太久了`);
});

test('只跑指定的練習；全部通過時回傳 0', () => {
	const result = runOn(['--dir', join(here, 'fixtures'), 'lesson-10']);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /^✓ lesson-10\/ex-1 /m);
	assert.doesNotMatch(result.stdout, /lesson-1\/ex-1/);
});

test('沒有符合的練習、資料夾不存在、或 --dir 沒給值時回傳 1', () => {
	const none = runOn(['--dir', join(here, 'fixtures'), 'lesson-99']);
	assert.equal(none.status, 1);
	assert.match(none.stdout, /找不到符合 lesson-99 的練習/);
	const missing = runOn(['--dir', join(here, 'no-such-folder')]);
	assert.equal(missing.status, 1);
	assert.match(missing.stdout, /找不到練習資料夾/);
	const noValue = runOn(['--dir']);
	assert.equal(noValue.status, 1);
	assert.match(noValue.stderr, /--dir 後面要給練習資料夾的路徑/);
});
