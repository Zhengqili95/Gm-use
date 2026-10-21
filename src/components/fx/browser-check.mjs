// Start a dedicated dev server first. Uses the installed Edge; no model calls.
// node src/components/fx/browser-check.mjs http://127.0.0.1:4347/Gm-use/dev/fx/
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://127.0.0.1:4347/Gm-use/dev/fx/';
const evidence = join(tmpdir(), 'vibe-t020-evidence');
mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
	await page.goto(url);
	await page.locator('vl-fx-demo[data-ready]').waitFor();
	assert.match(await page.title(), /學習回饋試玩/);
	assert.equal(await page.locator('vl-fx-demo button').count(), 7);
	const effects = await page.evaluate(async () => {
		const { play } = await import('/Gm-use/src/components/fx/fx.ts');
		const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
		const results = [];
		for (const effect of ['pop', 'shake', 'glow', 'slide-in']) {
			const el = document.querySelector(`[data-sample="${effect}"]`);
			play(el, effect);
			await pause(50);
			const first = el.getAnimations()[0];
			play(el, effect);
			await pause(50);
			const second = el.getAnimations()[0];
			const replay = !!second && first !== second && second.playState === 'running';
			await pause(1100);
			results.push({ effect, replay, cleaned: !el.classList.contains(`vl-fx-${effect}`) });
		}
		play(null, 'pop');
		return results;
	});
	for (const result of effects) { assert.equal(result.replay, true, result.effect); assert.equal(result.cleaned, true, result.effect); }
	console.log('effects', effects);

	for (const theme of ['light', 'dark']) {
		await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.screenshot({ path: join(evidence, `${theme}-desktop.png`), fullPage: true });
		await page.setViewportSize({ width: 375, height: 812 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		const sizes = await page.locator('vl-fx-demo button').evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().height));
		assert.ok(sizes.every(height => height >= 44));
		await page.screenshot({ path: join(evidence, `${theme}-mobile.png`), fullPage: true });
		for (const kind of ['pass', 'lesson']) {
			await page.locator(`[data-kind="${kind}"]`).click();
			await page.locator('.vl-fx-particles').waitFor();
			assert.deepEqual(await page.locator('.vl-fx-particles').evaluate(c => ({ hidden: c.getAttribute('aria-hidden'), pointer: getComputedStyle(c).pointerEvents })), { hidden: 'true', pointer: 'none' });
			await page.waitForTimeout(150);
			assert.equal(await page.locator('.vl-fx-particles').evaluate(c => {
				const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
				return data.some((v, i) => i % 4 === 3 && v > 0);
			}), true, `${theme} ${kind} must paint visible particles`);
			await page.screenshot({ path: join(evidence, `${theme}-${kind}.png`) });
			await page.waitForTimeout(1150);
			assert.equal(await page.locator('.vl-fx-particles').count(), 0);
		}
	}
	assert.equal(await page.evaluate(async () => {
		const { celebrate, FX_PARTICLES } = await import('/Gm-use/src/components/fx/fx.ts');
		const el = document.querySelector('[data-kind="pass"]');
		celebrate(null, 'pass', { force: true });
		celebrate(el, 'pass');
		if (FX_PARTICLES || document.querySelector('.vl-fx-particles')) return false;
		for (let i = 0; i < 10; i++) celebrate(el, 'lesson', { force: true });
		return document.querySelectorAll('.vl-fx-particles').length === 1;
	}), true);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.waitForTimeout(80);
	assert.equal(await page.locator('.vl-fx-particles').count(), 0);
	for (const button of await page.locator('vl-fx-demo button').all()) await button.click();
	assert.equal(await page.locator('.vl-fx-particles').count(), 0);
	assert.equal(await page.locator('vl-fx-demo [class*="vl-fx-"]').count(), 0);
	assert.equal(await page.evaluate(() => {
		const el = document.querySelector('[data-sample="slide-in"]');
		el.classList.add('vl-fx-slide-in');
		const style = getComputedStyle(el);
		const ok = style.animationName === 'none' && style.opacity === '1';
		el.classList.remove('vl-fx-slide-in');
		return ok;
	}), true);
	await page.screenshot({ path: join(evidence, 'reduced-motion.png'), fullPage: true });
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.locator('[data-effect="glow"]').click();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.waitForTimeout(80);
	assert.equal(await page.locator('.vl-fx-glow').count(), 0);
	assert.deepEqual(errors, []);
	console.log('PASS: themes, 375px, particles, replay, cleanup, reduced motion; evidence:', evidence);
} finally {
	await browser.close();
}
