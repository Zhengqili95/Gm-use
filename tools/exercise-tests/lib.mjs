// test:exercises 的純邏輯：找練習檔、檢查基本格式、判斷結果、組出要印的文字。
// 不碰瀏覽器，所以可以直接用 Node 測（lib.test.mjs，跟著 npm test 一起跑）。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

// 還不能測的練習類型：印「略過」，不算通過（M-051）
export const SKIPPED = {
	api: 'api 練習還不支援（等 T-014 的模擬伺服器）',
};

const LESSON = /^lesson-(\d+)$/;
const EXERCISE = /^ex-(\d+)\.yaml$/;
const byNumber = (pattern) => (a, b) => Number(pattern.exec(a)[1]) - Number(pattern.exec(b)[1]);

function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 找出 dir 底下所有 lesson-N/ex-K.yaml，依課和練習的號碼排好（lesson-2 在 lesson-10 前面）。
 * filters 是練習 id 的開頭，例如 lesson-1 或 lesson-1/ex-2；沒給就全部。
 * 回傳 [{ id, file, data }]，YAML 讀不懂的回傳 { id, file, error }。
 */
export function findExercises(dir, filters = []) {
	const matches = (id) => filters.length === 0 || filters.some((f) => id === f || id.startsWith(`${f.replace(/\/+$/, '')}/`));
	const lessons = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && LESSON.test(entry.name))
		.map((entry) => entry.name)
		.sort(byNumber(LESSON));
	const found = [];
	for (const lesson of lessons) {
		const names = readdirSync(join(dir, lesson))
			.filter((name) => EXERCISE.test(name))
			.sort(byNumber(EXERCISE));
		for (const name of names) {
			const id = `${lesson}/${name.replace(/\.yaml$/, '')}`;
			if (!matches(id)) continue;
			const file = join(dir, lesson, name);
			try {
				found.push({ id, file, data: parse(readFileSync(file, 'utf8')) });
			} catch (error) {
				const reason = String(error.message).split('\n')[0].replace(/[:：]\s*$/, '');
				found.push({ id, file, error: `YAML 讀不懂：${reason}` });
			}
		}
	}
	return found;
}

/** 跑檢查之前需要的最基本格式；完整的格式檢查是 npm run check:content 的工作 */
export function shapeProblem(data) {
	if (!isRecord(data)) return '內容不是一個物件';
	if (!Array.isArray(data.checks) || data.checks.length === 0) return '沒有 checks';
	if (data.checks.some((check) => !isRecord(check) || typeof check.id !== 'string' || typeof check.type !== 'string')) {
		return '有一條 check 缺少 id 或 type';
	}
	if (data.type === 'sql') {
		// sql 練習：資料表、起始的 SQL、標準答案都是一段文字
		for (const field of ['setup', 'starter', 'solution']) {
			if (typeof data[field] !== 'string' || !data[field].trim()) return `沒有 ${field}`;
		}
		return null;
	}
	if (!isRecord(data.files) || typeof data.files['index.html'] !== 'string') return 'files 裡沒有 index.html';
	if (!isRecord(data.solution)) return '沒有 solution';
	return null;
}

/**
 * 把 SQL 執行核心（T-015a 的 checkSqlExercise）的結果，換成和網頁練習一樣的形狀，才能用同一個 judge()。
 * SQL 出錯時每一條檢查都是 false，錯誤訊息放進 errors；逾時是 timedOut。
 */
export function fromSqlResult(result) {
	return {
		passed: Object.fromEntries((result?.checks ?? []).map((check) => [check.id, check.passed === true])),
		errors: result?.status === 'error' && result.error ? [result.error] : [],
		timedOut: result?.status === 'timeout',
	};
}

/**
 * 判斷一個練習：標準答案要通過全部檢查，起始內容要至少一條沒過。
 * start、solved 是檢查執行器的結果：{ passed: { 檢查 id: 是否通過 }, errors: [], timedOut }。
 * 「過關」和畫面的判斷一樣：每一條檢查都通過，逾時的檢查算沒過。
 * 標準答案執行時出錯，就算檢查都過了也算有問題：標準答案不該出錯，這幾乎一定是練習的 bug（M-063）。
 * 起始內容出錯是正常的，不用管。
 */
export function judge(checks, start, solved) {
	const ids = checks.map((check) => check.id);
	const solvedFailed = ids.filter((id) => solved.passed[id] !== true);
	const startFailed = ids.filter((id) => start.passed[id] !== true);
	const problems = [];
	if (solvedFailed.length > 0) {
		let text = `標準答案沒過：${solvedFailed.join('、')}`;
		if (solved.timedOut) text += '（執行逾時）';
		if (solved.errors.length > 0) text += `（程式錯誤：${solved.errors[0]}）`;
		problems.push(text);
	} else if (solved.errors.length > 0) {
		problems.push(`標準答案執行時出錯：${solved.errors[0]}`);
	}
	if (startFailed.length === 0) problems.push('起始內容就通過全部檢查，學習者不用改就過關');
	if (problems.length > 0) return { ok: false, text: problems.join('；') };
	return {
		ok: true,
		text: `標準答案全過；起始內容沒過：${startFailed.join('、')}${start.timedOut ? '（起始內容執行逾時）' : ''}`,
	};
}

const MARKS = { pass: '✓', fail: '✗', skip: '－' };

/** 每個練習印一行 */
export function formatLine(status, id, text) {
	return `${MARKS[status]} ${id}  ${text}`;
}

export function summary({ pass, fail, skip }) {
	return `通過 ${pass} 個、沒過 ${fail} 個、略過 ${skip} 個${skip > 0 ? '（略過的不算通過）' : ''}`;
}
