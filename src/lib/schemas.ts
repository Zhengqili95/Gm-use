// 內容檔（課文、練習、測驗）的格式定義，是 docs/CONTRACT.md 的可執行版本。
// 文件和這個檔案不一致時，以這個檔案為準，並在討論區回報，請 Claude-B 修文件。
//
// 約定版本：內容檔的 `contract` 欄位必須等於 CONTRACT_VERSION。
// 不相容的改動（改名、刪欄位、改意義）才會加一；只新增可省略的欄位不用。
import { z } from 'astro/zod';

export const CONTRACT_VERSION = 1;

const contract = z.literal(CONTRACT_VERSION);
const text = z.string().trim().min(1);
const selector = z.string().trim().min(1);

// ---------- 識別碼 ----------

export const exerciseId = z
  .string()
  .regex(/^lesson-\d+\/ex-\d+$/, '練習 id 要寫成 lesson-1/ex-1 的格式');
export const quizId = z
  .string()
  .regex(/^lesson-\d+\/quiz$/, '測驗 id 要寫成 lesson-1/quiz 的格式');
const checkId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'check 的 id 只能用小寫英文、數字和連字號，而且要以英文字母開頭');

// ---------- 課文 frontmatter ----------
// 接在 Starlight 的 docsSchema 後面：docsSchema({ extend: lessonFrontmatter })。
// docs collection 也有首頁之類的非課程頁，所以這裡的欄位都可以省略；
// 「lessons/ 底下的檔案一定要有這些欄位」由 check:content 檢查。

const source = z.strictObject({
  title: text,
  url: z.url().startsWith('https://'),
});

export const lessonFrontmatter = z.object({
  contract: contract.optional(),
  lesson: z.number().int().min(1).optional(),
  minutes: z.number().int().min(15).max(20).optional(),
  oneThing: text.optional(),
  result: text.optional(),
  sources: z.array(source).min(2).optional(),
  exercises: z.array(exerciseId).min(1).optional(),
  quiz: quizId.optional(),
  gates: z
    .strictObject({ sources: z.boolean(), review: z.boolean(), trial: z.boolean() })
    .optional(),
});

// ---------- 練習：檢查規則 ----------

const step = z.union([
  z.strictObject({ click: selector }),
  z.strictObject({ input: z.strictObject({ selector, value: z.string() }) }),
  z.strictObject({ wait: z.number().int().min(0).max(1000) }),
]);
const steps = z.array(step).min(1).optional();

// 次數或數量：寫成整數（剛好幾個），或 { min, max }（至少寫一個，而且 min 不能大於 max）
const countRange = z
  .strictObject({
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(0).optional(),
  })
  .refine((r) => r.min !== undefined || r.max !== undefined, 'count 的 { min, max } 至少要寫一個')
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, 'count 的 min 不能大於 max');
const countSpec = z.union([z.number().int().min(0), countRange]);

const baseCheck = { id: checkId, hint: text };

// 網頁類（preview、api）共用的檢查
const domChecks = [
  z.strictObject({
    ...baseCheck,
    type: z.literal('exists'),
    selector,
    count: countSpec.optional(),
    steps,
  }),
  z.strictObject({
    ...baseCheck,
    type: z.literal('text'),
    selector,
    equals: z.string().optional(),
    includes: z.string().optional(),
    matches: z.string().optional(),
    all: z.boolean().optional(),
    ignoreCase: z.boolean().optional(),
    steps,
  }),
  z.strictObject({
    ...baseCheck,
    type: z.literal('attr'),
    selector,
    name: text,
    equals: z.string().optional(),
    includes: z.string().optional(),
    matches: z.string().optional(),
    present: z.boolean().optional(),
    steps,
  }),
  z.strictObject({
    ...baseCheck,
    type: z.literal('style'),
    selector,
    property: text,
    equals: z.string().optional(),
    oneOf: z.array(z.string().min(1)).min(1).optional(),
    steps,
  }),
  z.strictObject({ ...baseCheck, type: z.literal('noError'), steps }),
] as const;

const httpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const requestCheck = z.strictObject({
  ...baseCheck,
  type: z.literal('request'),
  method: httpMethod,
  path: z.string().startsWith('/'),
  times: countSpec.optional(),
  query: z.record(z.string(), z.string()).optional(),
  bodyIncludes: z.record(z.string(), z.unknown()).optional(),
  steps,
});

// SQL 類的檢查
const cell = z.union([z.string(), z.number(), z.null()]);
const rows = z.array(z.array(cell));

const sqlChecks = [
  z.strictObject({
    ...baseCheck,
    type: z.literal('rows'),
    equals: rows,
    columns: z.array(z.string().min(1)).min(1).optional(),
    ordered: z.boolean().optional(),
  }),
  z.strictObject({
    ...baseCheck,
    type: z.literal('state'),
    query: text,
    equals: rows,
    ordered: z.boolean().optional(),
  }),
] as const;

// ---------- 練習：本體 ----------

const common = {
  contract,
  id: exerciseId,
  title: text,
  goal: text,
  minutes: z.number().int().min(1).max(3),
  hints: z.tuple([text, text, text]), // 觀念提醒 → 檢查位置 → 語法範例
  success: text,
};

const fileName = z.enum(['index.html', 'style.css', 'script.js']);
const startFiles = z.strictObject({
  'index.html': z.string().min(1),
  'style.css': z.string().optional(),
  'script.js': z.string().optional(),
});
const solutionFiles = z.strictObject({
  'index.html': z.string().optional(),
  'style.css': z.string().optional(),
  'script.js': z.string().optional(),
});
const pageParts = {
  files: startFiles,
  editable: z.array(fileName).min(1),
  solution: solutionFiles,
  previewHeight: z.number().int().min(120).max(480).optional(),
};

const mockRoute = z.strictObject({
  method: httpMethod.optional(),
  path: z.string().startsWith('/'),
  status: z.number().int().min(100).max(599).optional(),
  body: z.unknown().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  delayMs: z.number().int().min(0).max(1500).optional(),
});

const previewExercise = z.strictObject({
  ...common,
  type: z.literal('preview'),
  ...pageParts,
  checks: z.array(z.discriminatedUnion('type', [...domChecks])).min(1).max(4),
});

const apiExercise = z.strictObject({
  ...common,
  type: z.literal('api'),
  ...pageParts,
  api: z.strictObject({ routes: z.array(mockRoute).min(1) }),
  checks: z.array(z.discriminatedUnion('type', [...domChecks, requestCheck])).min(1).max(4),
});

const sqlExercise = z.strictObject({
  ...common,
  type: z.literal('sql'),
  setup: z.string().min(1),
  starter: z.string().min(1),
  solution: z.string().min(1),
  errorHint: text.optional(),
  checks: z.array(z.discriminatedUnion('type', [...sqlChecks])).min(1).max(4),
});

// index.html 有沒有用 <link href="style.css"> 或 <script src="script.js"> 參照某個檔案
function references(html: string, name: 'style.css' | 'script.js'): boolean {
  const escaped = name.replace('.', '\\.');
  const pattern =
    name === 'style.css'
      ? new RegExp(`<link\\b[^>]*\\bhref=["']${escaped}["']`, 'i')
      : new RegExp(`<script\\b[^>]*\\bsrc=["']${escaped}["']`, 'i');
  return pattern.test(html);
}

export const exerciseSchema = z
  .discriminatedUnion('type', [previewExercise, apiExercise, sqlExercise])
  .superRefine((ex, ctx) => {
    const fail = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });

    // 每條 check 的細部規則
    const checks = ex.checks as ReadonlyArray<Record<string, unknown> & { id: string; type: string }>;
    const seen = new Set<string>();
    checks.forEach((check, i) => {
      const at: (string | number)[] = ['checks', i];
      if (seen.has(check.id)) fail(`check 的 id「${check.id}」重複了`, [...at, 'id']);
      seen.add(check.id);

      const exactlyOne = (keys: string[]) => {
        const n = keys.filter((k) => check[k] !== undefined).length;
        if (n !== 1) fail(`type: ${check.type} 要在 ${keys.join('、')} 裡剛好寫一個`, at);
      };
      if (check.type === 'text') exactlyOne(['equals', 'includes', 'matches']);
      if (check.type === 'attr') exactlyOne(['equals', 'includes', 'matches', 'present']);
      if (check.type === 'style') exactlyOne(['equals', 'oneOf']);

      if (typeof check.matches === 'string') {
        try {
          new RegExp(check.matches);
        } catch {
          fail('matches 不是有效的規則運算式', [...at, 'matches']);
        }
      }
    });

    if (ex.type === 'sql') {
      if (ex.starter === ex.solution) fail('solution 和 starter 一樣', ['solution']);
      return;
    }

    // preview、api：檔案之間的關係
    const files = ex.files as Record<string, string | undefined>;
    const solution = ex.solution as Record<string, string | undefined>;
    const editable = ex.editable as string[];

    for (const name of editable) {
      if (files[name] === undefined) fail(`editable 的「${name}」不在 files 裡`, ['editable']);
    }
    const solved = Object.keys(solution).filter((k) => solution[k] !== undefined);
    if (solved.length === 0) fail('solution 至少要有一個檔案', ['solution']);
    for (const name of solved) {
      if (!editable.includes(name)) fail(`solution 的「${name}」不是可編輯的檔案`, ['solution', name]);
      else if (solution[name] === files[name]) fail(`solution 的「${name}」和起始內容一樣`, ['solution', name]);
    }

    const html = files['index.html'] ?? '';
    if (/<\s*(html|head|body)\b/i.test(html)) {
      fail('index.html 只寫 <body> 裡面的內容，不要寫 html、head、body 標籤', ['files', 'index.html']);
    }
    for (const name of ['style.css', 'script.js'] as const) {
      const exists = files[name] !== undefined;
      const referenced = references(html, name);
      if (exists && !referenced) fail(`files 有 ${name}，但 index.html 沒有參照它`, ['files', 'index.html']);
      if (!exists && referenced) fail(`index.html 參照了 ${name}，但 files 裡沒有`, ['files']);
    }
  });

// ---------- 測驗 ----------

const quizOption = z.strictObject({
  text,
  correct: z.boolean().optional(),
  explain: text,
});

const quizQuestion = z
  .strictObject({
    id: z.string().regex(/^q\d+$/, '題目 id 要寫成 q1、q2…'),
    prompt: text,
    code: z.string().min(1).optional(),
    options: z.array(quizOption).min(3).max(4),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.correct === true).length;
    if (correct !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: `每題要剛好一個 correct: true（這題有 ${correct} 個）`,
        path: ['options'],
      });
    }
  });

export const quizSchema = z
  .strictObject({
    contract,
    id: quizId,
    questions: z.array(quizQuestion).min(3).max(6),
  })
  .superRefine((quiz, ctx) => {
    const seen = new Set<string>();
    quiz.questions.forEach((q, i) => {
      if (seen.has(q.id)) {
        ctx.addIssue({ code: 'custom', message: `題目 id「${q.id}」重複了`, path: ['questions', i, 'id'] });
      }
      seen.add(q.id);
    });
  });

export type Exercise = z.infer<typeof exerciseSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type LessonFrontmatter = z.infer<typeof lessonFrontmatter>;
