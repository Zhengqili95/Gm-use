// npm run test:exercises：用真的瀏覽器和練習元件的檢查執行器，跑每個練習的標準答案和起始內容（docs/CONTRACT.md B9）。
// 標準答案要通過全部檢查，起始內容要至少一條沒過。說明見同資料夾的 README.md。
// 用法：node tools/exercise-tests/run.mjs [lesson-1 lesson-2/ex-3 ...] [--dir 練習資料夾]
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExerciseBrowser, HangError } from './browser.mjs';
import { bundleRunner } from './bundle.mjs';
import { findExercises, formatLine, judge, shapeProblem, SKIPPED, summary } from './lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
	const filters = [];
	let dir = join(repoRoot, 'src', 'lessons');
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === '--dir') dir = resolve(argv[++i] ?? '');
		else filters.push(argv[i]);
	}
	return { dir, filters };
}

async function main() {
	const { dir, filters } = parseArgs(process.argv.slice(2));
	if (!existsSync(dir)) {
		console.log(`找不到練習資料夾：${dir}`);
		return 1;
	}
	const exercises = findExercises(dir, filters);
	if (exercises.length === 0) {
		console.log(filters.length > 0 ? `找不到符合 ${filters.join('、')} 的練習。` : `${dir} 裡沒有練習。`);
		return 1;
	}

	const counts = { pass: 0, fail: 0, skip: 0 };
	const report = (status, id, text) => {
		counts[status] += 1;
		console.log(formatLine(status, id, text));
	};

	let browser;
	// 跑一次檢查；有檢查逾時就重開瀏覽器，把還在跑無窮迴圈的程序清掉，下一次才不會受影響
	async function runChecks(files, checks) {
		if (!browser) {
			browser = new ExerciseBrowser(await bundleRunner());
			await browser.start();
		}
		try {
			const outcome = await browser.run(files, checks);
			if (outcome.timedOut) await browser.restart();
			return outcome;
		} catch (error) {
			if (error instanceof HangError) await browser.restart();
			throw error;
		}
	}

	try {
		for (const exercise of exercises) {
			const { id, data, error } = exercise;
			if (error) {
				report('fail', id, error);
				continue;
			}
			const type = data?.type;
			if (SKIPPED[type]) {
				report('skip', id, `略過：${SKIPPED[type]}`);
				continue;
			}
			if (type !== 'preview') {
				report('fail', id, `不認得的練習類型「${type}」`);
				continue;
			}
			const problem = shapeProblem(data);
			if (problem) {
				report('fail', id, `格式不對：${problem}（完整的格式檢查請跑 npm run check:content）`);
				continue;
			}
			try {
				// 起始內容就是 files；套用標準答案和畫面的「套用答案」一樣：{ ...files, ...solution }
				const start = await runChecks(data.files, data.checks);
				const solved = await runChecks({ ...data.files, ...data.solution }, data.checks);
				const verdict = judge(data.checks, start, solved);
				report(verdict.ok ? 'pass' : 'fail', id, verdict.text);
			} catch (runError) {
				if (!(runError instanceof HangError)) throw runError;
				report('fail', id, `檢查卡住了：${runError.message}`);
			}
		}
	} finally {
		await browser?.stop();
	}

	console.log('');
	console.log(summary(counts));
	return counts.fail > 0 ? 1 : 0;
}

main().then(
	(code) => process.exit(code),
	(error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	},
);
