// test:exercises 不用瀏覽器的部分。要開瀏覽器的自我檢查在 self-check.mjs（不放進 npm test）。
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { findExercises, formatLine, fromSqlResult, judge, shapeProblem, SKIPPED, summary } from './lib.mjs';

function makeLessons(files) {
	const dir = mkdtempSync(join(tmpdir(), 'vibe-learn-ex-'));
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(join(dir, path, '..'), { recursive: true });
		writeFileSync(join(dir, path), content);
	}
	return dir;
}

const outcome = (passed, extra = {}) => ({ passed, errors: [], timedOut: false, ...extra });
const checks = [{ id: 'a' }, { id: 'b' }];

describe('找練習檔', () => {
	it('依號碼排序（lesson-2 在 lesson-10 前面），只收 lesson-N/ex-K.yaml', () => {
		const dir = makeLessons({
			'lesson-10/ex-1.yaml': 'type: preview',
			'lesson-2/ex-10.yaml': 'type: preview',
			'lesson-2/ex-2.yaml': 'type: preview',
			'lesson-2/quiz.yaml': 'id: lesson-2/quiz',
			'lesson-2/notes.md': '#',
			'drafts/ex-1.yaml': 'type: preview',
		});
		try {
			assert.deepEqual(
				findExercises(dir).map((ex) => ex.id),
				['lesson-2/ex-2', 'lesson-2/ex-10', 'lesson-10/ex-1'],
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('可以只跑某一課或某一題；lesson-1 不會選到 lesson-10', () => {
		const dir = makeLessons({
			'lesson-1/ex-1.yaml': 'type: preview',
			'lesson-1/ex-2.yaml': 'type: preview',
			'lesson-10/ex-1.yaml': 'type: preview',
		});
		try {
			assert.deepEqual(findExercises(dir, ['lesson-1']).map((ex) => ex.id), ['lesson-1/ex-1', 'lesson-1/ex-2']);
			assert.deepEqual(findExercises(dir, ['lesson-1/']).map((ex) => ex.id), ['lesson-1/ex-1', 'lesson-1/ex-2']);
			assert.deepEqual(findExercises(dir, ['lesson-1/ex-2', 'lesson-10']).map((ex) => ex.id), ['lesson-1/ex-2', 'lesson-10/ex-1']);
			assert.deepEqual(findExercises(dir, ['lesson-3']), []);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('YAML 讀不懂的檔案回報錯誤，不會讓整個測試停掉', () => {
		const dir = makeLessons({ 'lesson-1/ex-1.yaml': 'type: [preview', 'lesson-1/ex-2.yaml': 'type: preview' });
		try {
			const [broken, fine] = findExercises(dir);
			assert.match(broken.error, /^YAML 讀不懂：/);
			assert.doesNotMatch(broken.error, /[:：]$/);
			assert.equal(fine.data.type, 'preview');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe('基本格式', () => {
	const good = { type: 'preview', files: { 'index.html': '<p></p>' }, solution: { 'index.html': '<p>x</p>' }, checks: [{ id: 'a', type: 'text' }] };
	it('跑檢查需要的欄位都在就沒問題', () => {
		assert.equal(shapeProblem(good), null);
	});
	it('缺 checks、check 的 id、index.html、solution 都會說清楚', () => {
		assert.equal(shapeProblem(null), '內容不是一個物件');
		assert.equal(shapeProblem({ ...good, checks: [] }), '沒有 checks');
		assert.equal(shapeProblem({ ...good, checks: [{ type: 'text' }] }), '有一條 check 缺少 id 或 type');
		assert.equal(shapeProblem({ ...good, files: { 'style.css': '' } }), 'files 裡沒有 index.html');
		assert.equal(shapeProblem({ ...good, solution: undefined }), '沒有 solution');
	});
	it('只有 api 先略過；sql 已經接上 T-015a 的執行核心（T-009c）', () => {
		assert.ok(SKIPPED.api);
		assert.equal(SKIPPED.sql, undefined);
		assert.equal(SKIPPED.preview, undefined);
	});
	it('sql 練習要有 setup、starter、solution', () => {
		const sql = { type: 'sql', setup: 'CREATE TABLE t(a);', starter: 'SELECT 1;', solution: 'SELECT a FROM t;', checks: [{ id: 'c', type: 'rows' }] };
		assert.equal(shapeProblem(sql), null);
		assert.equal(shapeProblem({ ...sql, setup: undefined }), '沒有 setup');
		assert.equal(shapeProblem({ ...sql, starter: '   ' }), '沒有 starter');
		assert.equal(shapeProblem({ ...sql, solution: 42 }), '沒有 solution');
	});
});

describe('SQL 執行核心的結果', () => {
	it('換成和網頁練習一樣的形狀', () => {
		assert.deepEqual(fromSqlResult({ status: 'ok', checks: [{ id: 'a', passed: true }, { id: 'b', passed: false }] }), {
			passed: { a: true, b: false },
			errors: [],
			timedOut: false,
		});
	});
	it('出錯時附上 SQLite 的訊息，逾時標成 timedOut', () => {
		assert.deepEqual(fromSqlResult({ status: 'error', error: 'near "SELEC": syntax error', checks: [{ id: 'a', passed: false }] }), {
			passed: { a: false },
			errors: ['near "SELEC": syntax error'],
			timedOut: false,
		});
		assert.deepEqual(fromSqlResult({ status: 'timeout', checks: [{ id: 'a', passed: false }] }), {
			passed: { a: false },
			errors: [],
			timedOut: true,
		});
	});
	it('結果怪掉時，每一條檢查都算沒過', () => {
		assert.deepEqual(fromSqlResult(undefined), { passed: {}, errors: [], timedOut: false });
	});
});

describe('判斷結果', () => {
	it('標準答案全過、起始內容至少一條沒過，就是正常的練習', () => {
		assert.deepEqual(judge(checks, outcome({ a: true, b: false }), outcome({ a: true, b: true })), {
			ok: true,
			text: '標準答案全過；起始內容沒過：b',
		});
	});
	it('標準答案沒過：列出沒過的檢查，附上逾時和程式錯誤', () => {
		const verdict = judge(checks, outcome({ a: false, b: false }), outcome({ a: true, b: false }, { timedOut: true, errors: ['x is not defined'] }));
		assert.equal(verdict.ok, false);
		assert.equal(verdict.text, '標準答案沒過：b（執行逾時）（程式錯誤：x is not defined）');
	});
	it('標準答案檢查都過了，但執行時出錯，也算有問題；起始內容出錯不用管', () => {
		const verdict = judge(checks, outcome({ a: false, b: false }, { errors: ['起始內容的錯誤'] }), outcome({ a: true, b: true }, { errors: ['oops is not defined'] }));
		assert.deepEqual(verdict, { ok: false, text: '標準答案執行時出錯：oops is not defined' });
		assert.equal(judge(checks, outcome({ a: false, b: true }, { errors: ['起始內容的錯誤'] }), outcome({ a: true, b: true })).ok, true);
	});
	it('沒有結果的檢查算沒過（和畫面一樣）', () => {
		assert.equal(judge(checks, outcome({}), outcome({ a: true })).text, '標準答案沒過：b');
	});
	it('起始內容就全部通過，也算有問題', () => {
		const verdict = judge(checks, outcome({ a: true, b: true }), outcome({ a: true, b: true }));
		assert.deepEqual(verdict, { ok: false, text: '起始內容就通過全部檢查，學習者不用改就過關' });
	});
	it('兩個問題同時發生就都列出來', () => {
		const verdict = judge(checks, outcome({ a: true, b: true }), outcome({ a: false, b: true }));
		assert.equal(verdict.text, '標準答案沒過：a；起始內容就通過全部檢查，學習者不用改就過關');
	});
	it('起始內容逾時照樣算沒過，但會註明', () => {
		const verdict = judge(checks, outcome({ a: false, b: false }, { timedOut: true }), outcome({ a: true, b: true }));
		assert.equal(verdict.text, '標準答案全過；起始內容沒過：a、b（起始內容執行逾時）');
	});
});

describe('印出來的文字', () => {
	it('每個練習一行', () => {
		assert.equal(formatLine('pass', 'lesson-1/ex-1', '好'), '✓ lesson-1/ex-1  好');
		assert.equal(formatLine('fail', 'lesson-1/ex-1', '壞'), '✗ lesson-1/ex-1  壞');
		assert.equal(formatLine('skip', 'lesson-2/ex-1', '略過'), '－ lesson-2/ex-1  略過');
	});
	it('有略過時註明不算通過', () => {
		assert.equal(summary({ pass: 3, fail: 0, skip: 0 }), '通過 3 個、沒過 0 個、略過 0 個');
		assert.equal(summary({ pass: 1, fail: 1, skip: 2 }), '通過 1 個、沒過 1 個、略過 2 個（略過的不算通過）');
	});
});
