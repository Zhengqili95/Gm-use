// test:exercises 的瀏覽器部分：用 Playwright 開一個看不見的瀏覽器，載入打包好的檢查執行器，在裡面跑檢查。
import { chromium } from '@playwright/test';
import { GLOBAL_NAME } from './bundle.mjs';

// 一次檢查（起始內容或標準答案）最多等多久。檢查執行器每個 case 3 秒逾時、最多 4 條檢查，正常不會超過 12 秒
const RUN_TIMEOUT_MS = 30_000;
const KILL_TIMEOUT_MS = 15_000;
const BLANK = '<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"></head><body></body></html>';

/** Windows 用內建的 Edge，其他系統用 Google Chrome；EXERCISE_TEST_BROWSER 可以改（chromium 是 Playwright 自己下載的版本） */
export function defaultChannel() {
	return process.env.EXERCISE_TEST_BROWSER || (process.platform === 'win32' ? 'msedge' : 'chrome');
}

export class HangError extends Error {}

function withTimeout(promise, ms) {
	let timer;
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new HangError(`超過 ${ms / 1000} 秒沒有結果`)), ms);
		}),
	]).finally(() => clearTimeout(timer));
}

export class ExerciseBrowser {
	constructor(bundle, channel = defaultChannel()) {
		this.bundle = bundle;
		this.channel = channel;
	}

	async start() {
		try {
			// 用 launchServer 才拿得到瀏覽器的程序，結束時可以整棵程序樹一起結束（見 stop()）
			this.server = await chromium.launchServer(this.channel === 'chromium' ? {} : { channel: this.channel });
		} catch (error) {
			throw new Error(
				`開不了瀏覽器（${this.channel}）。Windows 會用內建的 Edge；其他系統要先裝 Google Chrome，` +
					'或設定 EXERCISE_TEST_BROWSER=chromium 並先執行 npx playwright install chromium。\n' +
					String(error.message).split('\n')[0],
			);
		}
		try {
			this.browser = await chromium.connect(this.server.wsEndpoint());
			this.page = await this.browser.newPage();
			await this.page.setContent(BLANK);
			await this.page.addScriptTag({ content: this.bundle });
		} catch (error) {
			await this.stop(); // 瀏覽器已經開了，失敗也要收掉
			throw error;
		}
	}

	/** 跑一次檢查，回傳 { passed, errors, timedOut }；整個卡住時丟出 HangError */
	run(files, checks) {
		return withTimeout(
			this.page.evaluate(([name, f, c]) => window[name].runForTest(f, c), [GLOBAL_NAME, files, checks]),
			RUN_TIMEOUT_MS,
		);
	}

	/**
	 * 不用 browser.close()：學習者的程式卡在無窮迴圈時，檢查執行器會在 3 秒後拿掉那個 iframe，
	 * 但跑那個 iframe 的程序不會停（實測一直佔著 CPU），Windows 上還會讓 close() 一直等下去。
	 * 所以直接結束整棵程序樹（Playwright 在 Windows 用 taskkill /T /F）。
	 */
	async stop() {
		const server = this.server;
		this.server = this.browser = this.page = undefined;
		if (server) await withTimeout(server.kill(), KILL_TIMEOUT_MS).catch(() => {});
	}

	async restart() {
		await this.stop();
		await this.start();
	}
}
