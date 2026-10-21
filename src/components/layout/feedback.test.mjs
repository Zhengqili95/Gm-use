// 每一課最下面的「回報問題／給建議」連結：哪幾頁放、網址的格式（feedback.ts）。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEEDBACK_FORM_URL, feedbackHref, isFormUrl } from './feedback.ts';

const form = 'https://forms.gle/abc123';

describe('回饋連結放在哪幾頁', () => {
	it('只有課程頁放', () => {
		assert.equal(feedbackHref(form, 'lessons/lesson-1'), form);
		assert.equal(feedbackHref(form, 'lessons/lesson-12'), form);
		assert.equal(feedbackHref(form, 'index'), null);
		assert.equal(feedbackHref(form, '404'), null);
		assert.equal(feedbackHref(form, 'dev/lab'), null);
		assert.equal(feedbackHref(form, 'lessons/lesson-1/extra'), null);
	});
	it('網址還沒填（空字串或只有空白），哪一頁都不放', () => {
		assert.equal(feedbackHref('', 'lessons/lesson-1'), null);
		assert.equal(feedbackHref('   ', 'lessons/lesson-1'), null);
	});
	it('網址前後的空白會去掉', () => {
		assert.equal(feedbackHref(` ${form} `, 'lessons/lesson-1'), form);
	});
	it('網址填錯就丟錯誤，不管是哪一頁（建置會失敗）', () => {
		assert.throws(() => feedbackHref('http://forms.gle/abc123', 'index'), /不是 Google 表單的網址/);
		assert.throws(() => feedbackHref('forms.gle/abc123', 'lessons/lesson-1'), /不是 Google 表單的網址/);
	});
});

describe('Google 表單的網址', () => {
	it('接受 forms.gle 的短網址和 docs.google.com/forms 的完整網址', () => {
		assert.ok(isFormUrl('https://forms.gle/abc123'));
		assert.ok(isFormUrl('https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform'));
	});
	it('不接受 http、別的網域、Google 文件、少了 https:// 的網址', () => {
		assert.equal(isFormUrl('http://forms.gle/abc123'), false);
		assert.equal(isFormUrl('https://example.com/forms/abc'), false);
		assert.equal(isFormUrl('https://docs.google.com.example.com/forms/abc'), false);
		assert.equal(isFormUrl('https://docs.google.com/document/d/abc/edit'), false);
		assert.equal(isFormUrl('forms.gle/abc123'), false);
	});
	it('現在填的網址：還沒填（空字串），或是 Google 表單的網址', () => {
		const url = FEEDBACK_FORM_URL.trim();
		assert.ok(url === '' || isFormUrl(url), `FEEDBACK_FORM_URL 填錯了：${FEEDBACK_FORM_URL}`);
	});
});
