// 每一課最下面的「回報問題／給建議」連結（規格「朋友的回饋」；T-004、T-012）。
// 網址是使用者建的 Google 表單（T-004，M-118）；改成空字串的話，哪一頁都不顯示這個連結。
// 只接受給填寫的人用的 Google 表單網址：填錯時 npm test 會抓到，建置也會失敗，不會把壞掉的連結放上線。

export const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeOudoOFkfMU6NVjcNkotNA_l_kbUfTO80tNw9mUjsp3jBT5g/viewform';

const LESSON = /^lessons\/lesson-\d+$/;
// 給填寫的人用的網址：forms.gle 的短網址，或 docs.google.com/forms/d/…/viewform。
// 編輯畫面的網址（結尾是 /edit）不算：學習者打開會看到「需要存取權」。
const SHORT_PATH = /^\/[\w-]+$/;
const RESPONDER_PATH = /^\/forms\/d\/(?:e\/)?[\w-]+\/viewform$/;

/** 是不是給填寫的人用的 Google 表單網址：https，forms.gle 的短網址，或是 docs.google.com/forms/d/…/viewform */
export function isFormUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'https:') return false;
	if (parsed.hostname === 'forms.gle') return SHORT_PATH.test(parsed.pathname);
	return parsed.hostname === 'docs.google.com' && RESPONDER_PATH.test(parsed.pathname);
}

/**
 * 這一頁的回饋連結要連到哪裡；不放連結時回傳 null。
 * 只有課程頁（entryId 是 lessons/lesson-N）而且填了網址才放。網址填錯就丟錯誤，不管是哪一頁，建置都會失敗。
 */
export function feedbackHref(url: string, entryId: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;
	if (!isFormUrl(trimmed)) {
		throw new Error(`FEEDBACK_FORM_URL 不是給填寫的人用的 Google 表單網址（forms.gle/… 或 …/viewform）：${trimmed}`);
	}
	return LESSON.test(entryId) ? trimmed : null;
}
