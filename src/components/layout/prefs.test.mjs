// 主題選單的四個選項怎麼存、怎麼讀回來（prefs.ts，D-029）。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHADE_KEY, THEME_KEY, parseThemeChoice, readThemeChoice, themeFor, themeStorage } from './prefs.ts';

/** 假的 localStorage：只放這次存的值 */
function storage(values = {}) {
	const map = new Map(Object.entries(values));
	return {
		read: (key) => (map.has(key) ? map.get(key) : null),
		save(entries) {
			for (const [key, value] of Object.entries(entries)) {
				if (value === null) map.delete(key);
				else map.set(key, value);
			}
		},
		map,
	};
}

describe('主題選單的值', () => {
	it('墨綠、黑色、淺色照收；其他的都當作自動', () => {
		assert.equal(parseThemeChoice('dark'), 'dark');
		assert.equal(parseThemeChoice('black'), 'black');
		assert.equal(parseThemeChoice('light'), 'light');
		for (const value of ['auto', '', null, undefined, 'Black', 'blue']) {
			assert.equal(parseThemeChoice(value), 'auto');
		}
	});
});

describe('讀回存的選擇', () => {
	it('沒存過、或存的是空字串，就是自動', () => {
		assert.equal(readThemeChoice(storage().read), 'auto');
		assert.equal(readThemeChoice(storage({ [THEME_KEY]: '' }).read), 'auto');
	});
	it('深色主題再加上黑色的標記，才是黑色', () => {
		assert.equal(readThemeChoice(storage({ [THEME_KEY]: 'dark' }).read), 'dark');
		assert.equal(readThemeChoice(storage({ [THEME_KEY]: 'dark', [SHADE_KEY]: 'black' }).read), 'black');
	});
	it('淺色或自動時，留著黑色的標記也不算黑色', () => {
		assert.equal(readThemeChoice(storage({ [THEME_KEY]: 'light', [SHADE_KEY]: 'black' }).read), 'light');
		assert.equal(readThemeChoice(storage({ [THEME_KEY]: '', [SHADE_KEY]: 'black' }).read), 'auto');
	});
});

describe('存起來再讀回來', () => {
	for (const choice of ['dark', 'black', 'light', 'auto']) {
		it(`${choice}：讀回來一樣`, () => {
			const s = storage({ [THEME_KEY]: 'light', [SHADE_KEY]: 'black' });
			s.save(themeStorage(choice));
			assert.equal(readThemeChoice(s.read), choice);
		});
	}
	it('黑色在 Starlight 的 key 裡存成 dark，Starlight 才會套用深色主題', () => {
		assert.deepEqual(themeStorage('black'), { [THEME_KEY]: 'dark', [SHADE_KEY]: 'black' });
	});
	it('換回其他選項，黑色的標記會刪掉', () => {
		for (const choice of ['dark', 'light', 'auto']) {
			const s = storage();
			s.save(themeStorage('black'));
			s.save(themeStorage(choice));
			assert.equal(s.map.has(SHADE_KEY), false, choice);
		}
	});
	it('自動在 Starlight 的 key 裡存成空字串（和 Starlight 原本一樣）', () => {
		assert.equal(themeStorage('auto')[THEME_KEY], '');
	});
});

describe('<html> 的 data-theme', () => {
	it('墨綠和黑色都是 dark，淺色是 light，不管系統設定', () => {
		for (const systemPrefersLight of [true, false]) {
			assert.equal(themeFor('dark', systemPrefersLight), 'dark');
			assert.equal(themeFor('black', systemPrefersLight), 'dark');
			assert.equal(themeFor('light', systemPrefersLight), 'light');
		}
	});
	it('自動就照系統的深淺色', () => {
		assert.equal(themeFor('auto', true), 'light');
		assert.equal(themeFor('auto', false), 'dark');
	});
});
