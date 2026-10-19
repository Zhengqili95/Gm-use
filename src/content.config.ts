import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { exerciseSchema, lessonFrontmatter, quizSchema } from './lib/schemas';

export const collections = {
	// 課文：Starlight 的欄位，加上每一課要有的欄位（格式見 docs/CONTRACT.md）
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: lessonFrontmatter }) }),
	i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
	// 練習和測驗的資料放在 src/lessons/lesson-N/
	exercises: defineCollection({
		loader: glob({ pattern: '**/ex-*.yaml', base: './src/lessons' }),
		schema: exerciseSchema,
	}),
	quizzes: defineCollection({
		loader: glob({ pattern: '**/quiz.yaml', base: './src/lessons' }),
		schema: quizSchema,
	}),
};
