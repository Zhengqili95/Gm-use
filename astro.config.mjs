// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
	// 網站發布在 GitHub Pages：https://zhengqili95.github.io/Gm-use/ （T-018：帳號 Zhengqili95、repo Gm-use）。
	// 所有網址都在 base 底下，連結不要寫死 /lessons/...，用相對路徑或 import.meta.env.BASE_URL。
	// repo 改名時 base 要一起改，大小寫要和 repo 名稱一樣。
	site: 'https://zhengqili95.github.io',
	base: '/Gm-use',
	integrations: [
		starlight({
			title: 'vibe-learn',
			description: '免費的 AI 時代學習平台：給想用 AI 做出作品的人。',
			locales: {
				root: { label: '繁體中文', lang: 'zh-TW' },
			},
			// fx.css：互動回饋共用的動畫（T-020、D-025），練習、測驗、側邊欄都會用到，所以每一頁都載入
			customCss: ['./src/styles/theme.css', './src/components/fx/fx.css'],
			// 首頁的按鈕不連到還沒上線的課，說明見 src/components/layout/README.md
			routeMiddleware: './src/components/layout/route-data.ts',
			components: {
				// 在側邊欄上方加「學習進度」區塊，說明見 src/components/layout/README.md
				Sidebar: './src/components/layout/Sidebar.astro',
			},
			sidebar: [
				{
					// 名稱「課程」也被 Sidebar.astro 拿來計算總共有幾課，改名時要一起改
					label: '課程',
					items: [{ autogenerate: { directory: 'lessons' } }],
				},
			],
		}),
		preact(),
	],
});
