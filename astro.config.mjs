// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import preact from '@astrojs/preact';

// 發布到 GitHub Pages 前要加上 site 和 base（等 T-018 決定 GitHub 帳號和 repo 名稱）：
//   site: 'https://<帳號>.github.io',
//   base: '/<repo 名稱>',
// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'vibe-learn',
			description: '免費的 AI 時代學習平台：給想用 AI 做出作品的人。',
			locales: {
				root: { label: '繁體中文', lang: 'zh-TW' },
			},
			customCss: ['./src/styles/theme.css'],
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
