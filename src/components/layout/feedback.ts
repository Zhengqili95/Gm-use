// 每一課最下面的「回報問題／給建議」連結（規格「朋友的回饋」；T-004、T-012）。
// 使用者建好 Google 表單之後，把網址填在 FEEDBACK_FORM_URL；空字串時哪一頁都不顯示這個連結。
// 只接受 Google 表單的網址：填錯時 npm test 會抓到，建置也會失敗，不會把壞掉的連結放上線。

export const FEEDBACK_FORM_URL = '';

const LESSON = /^lessons\/lesson-\d+$/;

/** 是不是 Google 表單的網址：https，網域是 forms.gle，或是 docs.google.com/forms/… */
export function isFormUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'https:') return false;
	return parsed.hostname === 'forms.gle' || (parsed.hostname === 'docs.google.com' && parsed.pathname.startsWith('/forms/'));
}

/**
 * 這一頁的回饋連結要連到哪裡；不放連結時回傳 null。
 * 只有課程頁（entryId 是 lessons/lesson-N）而且填了網址才放。網址填錯就丟錯誤，不管是哪一頁，建置都會失敗。
 */
export function feedbackHref(url: string, entryId: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;
	if (!isFormUrl(trimmed)) throw new Error(`FEEDBACK_FORM_URL 不是 Google 表單的網址：${trimmed}`);
	return LESSON.test(entryId) ? trimmed : null;
}
