// Starlight 的路由中介層（T-012），在 astro.config.mjs 的 routeMiddleware 登記。
// 首頁主視覺的按鈕：
// 1. 連到還沒上線的課（draft: true）的，拿掉（D-013：首頁不連到還沒上線的課）。
// 2. 相對連結補上 base。首頁網址少了結尾的「/」時（例如 /Gm-use），相對連結會連錯地方。
import { getCollection } from 'astro:content';
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
const isRelative = (link: string) => !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(link);

export const onRequest = defineRouteMiddleware(async (context) => {
	const hero = context.locals.starlightRoute.entry.data.hero;
	if (!hero?.actions?.length) return;
	const drafts = new Set(
		(await getCollection('docs', ({ id, data }) => id.startsWith('lessons/') && data.draft)).map(({ id }) => id),
	);
	hero.actions = hero.actions
		.filter((action) => {
			const lesson = /lessons\/lesson-\d+/.exec(action.link)?.[0];
			return !lesson || !drafts.has(lesson);
		})
		.map((action) => (isRelative(action.link) ? { ...action, link: `${base}${action.link}` } : action));
});
