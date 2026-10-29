// 學習者自己選的顯示方式（D-029）：主題多一個「黑色」，右邊的「本頁內容」可以收合。都存在瀏覽器的 localStorage。
// 頁面一開始就要套用的部分寫在 ThemeProvider.astro 的內嵌腳本（那裡不能 import），讀法要和這裡一樣，改的時候兩邊一起改。

/** 主題選單的四個選項。「黑色」是深色主題換成黑底，品牌綠不變。 */
export type ThemeChoice = 'dark' | 'black' | 'light' | 'auto';

/** Starlight 自己存主題的 key：'dark'、'light'，自動是空字串。選「黑色」時這裡也存 'dark'，Starlight 才會套用深色主題。 */
export const THEME_KEY = 'starlight-theme';
/** 選「黑色」時存 'black'，選其他的就刪掉。 */
export const SHADE_KEY = 'vl-dark-shade';
/** 「本頁內容」展開時存 'open'，收起來時存 'closed'；沒存過就是收起來（預設收起來）。 */
export const TOC_KEY = 'vl-toc';

type Read = (key: string) => string | null;

declare global {
	/** ThemeProvider.astro 的內嵌腳本放在 window 上的小工具，和 Starlight 的 StarlightThemeProvider 一樣的做法 */
	var VlPrefs: {
		/** 把每個主題選單換成目前的選擇和對應的圖示；不給參數就照存的值 */
		updatePickers(choice?: ThemeChoice): void;
	};
}

/** 選單上的值；不認得的都當作「自動」 */
export function parseThemeChoice(value: unknown): ThemeChoice {
	return value === 'dark' || value === 'black' || value === 'light' ? value : 'auto';
}

/** 照存的值，算出主題選單該選哪一個 */
export function readThemeChoice(read: Read): ThemeChoice {
	const theme = read(THEME_KEY);
	if (theme === 'light') return 'light';
	if (theme === 'dark') return read(SHADE_KEY) === 'black' ? 'black' : 'dark';
	return 'auto';
}

/** 選了某個選項之後，兩個 key 各要存什麼；null 代表刪掉 */
export function themeStorage(choice: ThemeChoice): Record<string, string | null> {
	return {
		[THEME_KEY]: choice === 'auto' ? '' : choice === 'light' ? 'light' : 'dark',
		[SHADE_KEY]: choice === 'black' ? 'black' : null,
	};
}

/** <html> 的 data-theme：選「自動」就照系統的深淺色 */
export function themeFor(choice: ThemeChoice, systemPrefersLight: boolean): 'dark' | 'light' {
	if (choice === 'auto') return systemPrefersLight ? 'light' : 'dark';
	return choice === 'light' ? 'light' : 'dark';
}
