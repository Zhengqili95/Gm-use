// Starlight 的路由中介層（T-012），在 astro.config.mjs 的 routeMiddleware 登記。
// 首頁主視覺的按鈕如果連到還沒上線的課（draft: true），就拿掉（D-013：首頁不連到還沒上線的課）。
import { getCollection } from 'astro:content';
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

export const onRequest = defineRouteMiddleware(async (context) => {
	const hero = context.locals.starlightRoute.entry.data.hero;
	if (!hero?.actions?.length) return;
	const drafts = new Set(
		(await getCollection('docs', ({ id, data }) => id.startsWith('lessons/') && data.draft)).map(({ id }) => id),
	);
	hero.actions = hero.actions.filter((action) => {
		const lesson = /lessons\/lesson-\d+/.exec(action.link)?.[0];
		return !lesson || !drafts.has(lesson);
	});
});
