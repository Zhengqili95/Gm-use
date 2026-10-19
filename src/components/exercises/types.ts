import type { Exercise } from '../../lib/schemas';

// 網頁類（preview、api）的練習；sql 類由 T-015 處理
export type PageExercise = Extract<Exercise, { type: 'preview' | 'api' }>;
export type PageCheck = PageExercise['checks'][number];

export type Step = { click: string } | { input: { selector: string; value: string } } | { wait: number };

// 虛擬檔案：只有 index.html、style.css、script.js 三個檔名
export type Files = Record<string, string | undefined>;
