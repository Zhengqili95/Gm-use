// 約定的測試：docs/CONTRACT.md 裡的範例要通過 src/lib/schemas.ts，故意寫錯的版本要被擋下來。
// 執行：npm run test:schemas
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { CONTRACT_VERSION, exerciseSchema, lessonFrontmatter, quizSchema } from './schemas.ts';

const docPath = fileURLToPath(new URL('../../docs/CONTRACT.md', import.meta.url));

// 找出文件裡所有的程式碼區塊（支援三個和四個反引號的外層）
function extractBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(`{3,})(\S*)\s*$/);
    if (!m) continue;
    const body = [];
    i++;
    while (i < lines.length && lines[i].trim() !== m[1]) body.push(lines[i++]);
    blocks.push({ lang: m[2], text: body.join('\n') });
  }
  return blocks;
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const issuesOf = (r) => r.error.issues.map((i) => `${i.message} ${i.path.join('.')}`).join(' | ');

function accepts(schema, value) {
  const r = schema.safeParse(value);
  assert.ok(r.success, r.success ? '' : issuesOf(r));
}

function rejects(schema, value, expectInMessage) {
  const r = schema.safeParse(value);
  assert.ok(!r.success, '應該被擋下來，但通過了');
  if (expectInMessage) {
    assert.ok(issuesOf(r).includes(expectInMessage), `被擋下來了，但訊息不是預期的。預期含「${expectInMessage}」，實際：${issuesOf(r)}`);
  }
}

// ---- 讀出文件裡的範例 ----
const exercises = new Map();
const quizzes = new Map();
let lessonFile = '';
for (const { lang, text } of extractBlocks(readFileSync(docPath, 'utf8'))) {
  if (lang === 'mdx') lessonFile = text;
  if (lang !== 'yaml') continue;
  const m = text.split('\n')[0].match(/^# src\/lessons\/(lesson-\d+)\/(ex-\d+|quiz)\.yaml$/);
  if (!m) continue;
  (m[2] === 'quiz' ? quizzes : exercises).set(`${m[1]}/${m[2]}`, parseYaml(text));
}

const ex1 = exercises.get('lesson-1/ex-1');
const ex2 = exercises.get('lesson-1/ex-2');
const ex3 = exercises.get('lesson-1/ex-3');
const api1 = exercises.get('lesson-2/ex-1');
const sql1 = exercises.get('lesson-3/ex-1');
const quiz1 = quizzes.get('lesson-1/quiz');

describe('約定文件裡的範例都要通過 schema', () => {
  it('文件裡有三種練習和一份測驗的範例', () => {
    assert.deepEqual([...new Set([...exercises.values()].map((e) => e.type))].sort(), ['api', 'preview', 'sql']);
    assert.equal(quizzes.size, 1);
  });

  for (const [id, data] of exercises) {
    it(`練習 ${id}（${data.type}）`, () => {
      accepts(exerciseSchema, data);
      assert.equal(data.id, id, 'id 要等於檔案路徑');
    });
  }

  for (const [id, data] of quizzes) {
    it(`測驗 ${id}`, () => {
      accepts(quizSchema, data);
      assert.equal(data.id, id, 'id 要等於檔案路徑');
    });
  }

  it('課文的 frontmatter 和 <Exercise>、<Quiz> 互相對得上', () => {
    const m = lessonFile.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    assert.ok(m, '找不到 frontmatter');
    const fm = parseYaml(m[1]);
    const ext = {};
    for (const k of ['contract', 'lesson', 'minutes', 'oneThing', 'result', 'sources', 'exercises', 'quiz', 'gates']) ext[k] = fm[k];
    accepts(lessonFrontmatter, ext);
    for (const k of ['title', 'description', 'sidebar', 'draft', ...Object.keys(ext)]) assert.notEqual(fm[k], undefined, `缺少必填欄位 ${k}`);
    assert.equal(fm.contract, CONTRACT_VERSION);
    assert.equal(fm.sidebar.order, fm.lesson, 'sidebar.order 要等於 lesson');
    assert.deepEqual([...m[2].matchAll(/<Exercise\s+id="([^"]+)"/g)].map((x) => x[1]), fm.exercises);
    assert.deepEqual([...m[2].matchAll(/<Quiz\s+id="([^"]+)"/g)].map((x) => x[1]), [fm.quiz]);
    for (const id of fm.exercises) assert.ok(exercises.has(id), `練習 ${id} 的範例不在文件裡`);
    assert.ok(quizzes.has(fm.quiz));
    assert.equal(fm.draft, true);
    assert.ok(Object.values(fm.gates).every((v) => v === false));
  });
});

describe('寫錯的練習要被擋下來', () => {
  const cases = [
    ['拼錯欄位（hnit）', () => ({ ...clone(ex1), hnit: 'x' }), 'hnit'],
    ['hints 只有兩則', () => ({ ...clone(ex1), hints: clone(ex1.hints).slice(0, 2) })],
    ['hints 有四則', () => ({ ...clone(ex1), hints: [...clone(ex1.hints), '多一則'] })],
    ['contract 不是 1', () => ({ ...clone(ex1), contract: 2 })],
    ['id 格式錯誤', () => ({ ...clone(ex1), id: 'ex-1' }), 'lesson-1/ex-1'],
    ['minutes 超過 3', () => ({ ...clone(ex1), minutes: 5 })],
    ['type 不存在', () => ({ ...clone(ex1), type: 'video' })],
    ['text 檢查同時寫 equals 和 includes', () => { const x = clone(ex1); x.checks[0].includes = '標題'; return x; }, '剛好寫一個'],
    ['text 檢查三個都沒寫', () => { const x = clone(ex1); delete x.checks[0].equals; return x; }, '剛好寫一個'],
    ['style 檢查 equals 和 oneOf 都寫', () => { const x = clone(ex2); x.checks[0].oneOf = ['red']; return x; }, '剛好寫一個'],
    ['檢查缺 hint', () => { const x = clone(ex1); delete x.checks[0].hint; return x; }],
    ['檢查的 id 重複', () => { const x = clone(ex3); x.checks[1].id = x.checks[0].id; return x; }, '重複'],
    ['matches 不是有效的規則運算式', () => { const x = clone(ex1); delete x.checks[0].equals; x.checks[0].matches = '('; return x; }, '規則運算式'],
    ['一個練習有 5 條檢查', () => { const x = clone(ex3); x.checks.push({ ...clone(x.checks[0]), id: 'extra-1' }, { ...clone(x.checks[0]), id: 'extra-2' }); return x; }],
    ['count 寫成空物件', () => { const x = clone(ex1); x.checks.push({ id: 'has-p', type: 'exists', selector: 'p', count: {}, hint: 'h' }); return x; }, '至少要寫一個'],
    ['count 的 min 大於 max', () => { const x = clone(ex1); x.checks.push({ id: 'has-p', type: 'exists', selector: 'p', count: { min: 3, max: 1 }, hint: 'h' }); return x; }, 'min 不能大於 max'],
    ['solution 和起始內容一樣', () => { const x = clone(ex1); x.solution = clone(x.files); return x; }, '一樣'],
    ['index.html 寫了 <body>', () => { const x = clone(ex1); x.files['index.html'] = `<body>${x.files['index.html']}</body>`; x.solution['index.html'] += '<!-- 不同 -->'; return x; }, 'body'],
    ['有 style.css 卻沒有參照它', () => { const x = clone(ex2); x.files['index.html'] = x.files['index.html'].replace(/<link[^>]*>\n?/, ''); return x; }, '沒有參照'],
    ['參照了不存在的 script.js', () => { const x = clone(ex1); x.files['index.html'] += '\n<script src="script.js"></script>'; x.solution['index.html'] += '\n<script src="script.js"></script>'; return x; }, '裡沒有'],
    ['editable 的檔案不在 files 裡', () => ({ ...clone(ex1), editable: ['style.css'] }), '不在 files'],
    ['solution 改了不可編輯的檔案', () => { const x = clone(ex2); x.solution['index.html'] = `${x.files['index.html']}<!-- 改了 -->`; return x; }, '不是可編輯'],
    ['preview 類型不能用 request 檢查', () => { const x = clone(ex1); x.checks.push({ id: 'req', type: 'request', method: 'GET', path: '/x', hint: 'h' }); return x; }],
    ['api 類型缺 api.routes', () => { const x = clone(api1); delete x.api; return x; }],
    ['request 的 times 寫成空物件', () => { const x = clone(api1); x.checks[0].times = {}; return x; }, '至少要寫一個'],
    ['檔名不在三個之內', () => { const x = clone(ex1); x.files['app.js'] = 'x'; return x; }],
    ['sql 的 rows 檢查缺 equals', () => { const x = clone(sql1); delete x.checks[0].equals; return x; }],
    ['sql 類型不能有 steps', () => { const x = clone(sql1); x.checks[0].steps = [{ click: '#x' }]; return x; }],
    ['sql 的 solution 和 starter 一樣', () => ({ ...clone(sql1), solution: sql1.starter }), '一樣'],
    ['step 寫了不認識的動作', () => { const x = clone(ex3); x.checks[1].steps = [{ hover: '#fav' }]; return x; }],
    ['wait 超過 1000', () => { const x = clone(ex3); x.checks[1].steps = [{ wait: 5000 }]; return x; }],
  ];
  for (const [name, build, expect] of cases) it(name, () => rejects(exerciseSchema, build(), expect));
});

describe('寫錯的測驗要被擋下來', () => {
  const cases = [
    ['有兩個正確答案', () => { const x = clone(quiz1); x.questions[0].options[1].correct = true; return x; }, 'correct'],
    ['沒有正確答案', () => { const x = clone(quiz1); delete x.questions[0].options[0].correct; return x; }, 'correct'],
    ['只有 2 題', () => ({ ...clone(quiz1), questions: clone(quiz1.questions).slice(0, 2) })],
    ['選項缺 explain', () => { const x = clone(quiz1); delete x.questions[0].options[0].explain; return x; }],
    ['題目 id 重複', () => { const x = clone(quiz1); x.questions[1].id = 'q1'; return x; }, '重複'],
    ['id 格式錯誤', () => ({ ...clone(quiz1), id: 'quiz-1' })],
  ];
  for (const [name, build, expect] of cases) it(name, () => rejects(quizSchema, build(), expect));
});

describe('課文的 frontmatter', () => {
  const good = {
    contract: 1, lesson: 1, minutes: 20, oneThing: 'a', result: 'b',
    sources: [{ title: 'a', url: 'https://example.com/a' }, { title: 'b', url: 'https://example.com/b' }],
    exercises: ['lesson-1/ex-1'], quiz: 'lesson-1/quiz', gates: { sources: false, review: false, trial: false },
  };
  it('基準資料通過', () => accepts(lessonFrontmatter, good));
  it('非課程頁（全部省略）也通過', () => accepts(lessonFrontmatter, {}));
  it('來源只有 1 筆', () => rejects(lessonFrontmatter, { ...good, sources: good.sources.slice(0, 1) }));
  it('來源不是 https', () => rejects(lessonFrontmatter, { ...good, sources: [{ title: 'a', url: 'http://example.com' }, good.sources[1]] }));
  it('minutes 是 25', () => rejects(lessonFrontmatter, { ...good, minutes: 25 }));
  it('gates 少一項', () => rejects(lessonFrontmatter, { ...good, gates: { sources: true, review: true } }));
  it('練習 id 格式錯誤', () => rejects(lessonFrontmatter, { ...good, exercises: ['ex-1'] }));
});
