import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse, stringify } from 'yaml';
import { checkContent } from './index.mjs';
import { analyzeSvg, checkSvg } from './svg.mjs';

const contract = readFileSync(new URL('../../../docs/CONTRACT.md', import.meta.url), 'utf8');
const example = (id) => {
  const block = contract.match(new RegExp('```yaml\\r?\\n# src/lessons/' + id + '\\.yaml\\r?\\n([\\s\\S]*?)```'));
  assert.ok(block, id);
  return parse(block[1]);
};
const svg = contract.match(/```svg\r?\n([\s\S]*?)```/)[1];
const lessonFile = 'src/content/docs/lessons/lesson-1.mdx';
const exerciseFile = 'src/lessons/lesson-1/ex-1.yaml';
const quizFile = 'src/lessons/lesson-1/quiz.yaml';
const svgFile = 'src/lessons/lesson-1/diagrams/browser-server.svg';
const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const validFront = () => ({
  title: '第 1 課｜畫面是怎麼拼出來的', description: '認識 HTML',
  sidebar: { order: 1 }, contract: 1, lesson: 1, minutes: 15,
  oneThing: '標籤定義結構', result: '完成卡片',
  sources: [{ title: 'HTML', url: 'https://developer.mozilla.org/zh-TW/docs/Web/HTML' },
    { title: 'CSS', url: 'https://developer.mozilla.org/zh-TW/docs/Web/CSS' }],
  exercises: ['lesson-1/ex-1'], quiz: 'lesson-1/quiz',
  gates: { sources: true, review: true, trial: true }, draft: false,
});
const validBody = '\n<Exercise id="lesson-1/ex-1" />\n\n<Quiz id="lesson-1/quiz" />\n\n<Diagram name="lesson-1/browser-server" alt="瀏覽器與伺服器" />\n';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'vibe-content-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('vibe-content-'));
    rmSync(root, { recursive: true, force: true });
  });
  const put = (file, text) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  const get = (file) => readFileSync(path.join(root, file), 'utf8');
  const data = (file, edit) => { const value = parse(get(file)); edit(value); put(file, stringify(value)); };
  const front = (edit, body = validBody) => {
    const value = validFront(); edit(value);
    put(lessonFile, '---\n' + stringify(value) + '---\n' + body);
  };
  const remove = (file) => rmSync(path.join(root, file));
  // Create the renamed fixture without relying on Windows rename permissions.
  const move = (from, to) => { put(to, get(from)); remove(from); };
  front(() => {});
  put(exerciseFile, stringify(example('lesson-1/ex-1')));
  put(quizFile, stringify(example('lesson-1/quiz')));
  put(svgFile, svg);
  return { root, put, get, data, front, remove, move };
}

test('完整內容與約定第 5 節 SVG 範例通過', async (t) => {
  assert.deepEqual(await checkContent(fixture(t).root), []);
});
test('API 與 SQL 練習沿用同一份 schema 並可通過', async (t) => {
  const f = fixture(t);
  for (const id of ['lesson-2/ex-1', 'lesson-3/ex-1']) {
    const value = example(id);
    value.id = 'lesson-1/ex-1';
    f.put(exerciseFile, stringify(value));
    assert.deepEqual(await checkContent(f.root), []);
  }
});
test('缺少必填欄位用繁體中文說明', async (t) => {
  const f = fixture(t); f.front(v => { delete v.title; });
  const errors = await checkContent(f.root);
  assert.ok(errors.some(e => /title/.test(e.reason) && /必填/.test(e.reason)), JSON.stringify(errors));
});
test('草稿可尚未通過三關；lesson-0 與非課程頁略過', async (t) => {
  const f = fixture(t);
  f.front((v) => { v.draft = true; v.gates.trial = false; });
  f.put('src/lessons/lesson-0/ex-bad.yaml', 'not: [yaml');
  f.put('src/lessons/lesson-0/diagrams/unsafe.svg', '<script/>');
  f.put('src/content/docs/dev/lab.mdx', '開發頁');
  assert.deepEqual(await checkContent(f.root), []);
});
test('MDX 程式區塊、行內程式與註解中的標籤不是實際引用', async (t) => {
  const f = fixture(t);
  f.front(() => {}, validBody + '\n```mdx\n<Exercise id="lesson-1/ex-99" />\n```\n\n`<Quiz id="lesson-9/quiz" />`\n\n{/* <Diagram name="lesson-1/missing" /> */}');
  assert.deepEqual(await checkContent(f.root), []);
});
test('多行 JSX、單引號、引號內 > 字元可正確解析', async (t) => {
  const f = fixture(t);
  f.front(() => {}, validBody.replace('<Exercise id="lesson-1/ex-1" />', "<Exercise\n id='lesson-1/ex-1'\n />").replace('alt="瀏覽器與伺服器"', 'alt="請求 > 回應"'));
  assert.deepEqual(await checkContent(f.root), []);
});
test('SVG 內部 url、透明填色及繼承字體通過', async (t) => {
  const f = fixture(t);
  f.put(svgFile, svg.replace('<text x="70"', '<text fill="none" x="70"').replace('font-size="16"', '').replace('<svg xmlns=', '<svg font-size="16" xmlns='));
  assert.deepEqual(await checkContent(f.root), []);
});

// ---- 約定 1.2：草稿課文只要四個欄位 ----
const draftFront = (v) => {
  for (const key of Object.keys(v)) if (!['title', 'description', 'sidebar', 'draft'].includes(key)) delete v[key];
  v.draft = true;
};
const placeholderBody = '\n這一課還在準備中。\n';
test('草稿只要有 title、description、sidebar.order、draft', async (t) => {
  const f = fixture(t);
  f.front(draftFront, placeholderBody);
  assert.deepEqual(await checkContent(f.root), []);
});
for (const field of ['title', 'description', 'sidebar', 'draft']) {
  test('草稿缺少 ' + field + ' 仍然報錯', async (t) => {
    const f = fixture(t);
    f.front((v) => { draftFront(v); delete v[field]; }, placeholderBody);
    const errors = await checkContent(f.root);
    assert.ok(errors.some(e => e.file.includes(lessonFile) && /必填/.test(e.reason) && new RegExp(field).test(e.reason)), JSON.stringify(errors));
  });
}
const draftChecked = [
  ['minutes 超出範圍', (v) => { v.minutes = 99; }, /minutes/],
  ['sources 不是 https', (v) => { v.sources = [{ title: 'a', url: 'http://example.org' }, { title: 'b', url: 'https://example.org' }]; }, /sources/],
  ['gates 少一項', (v) => { v.gates = { sources: true, review: true }; }, /gates/],
  ['exercises 指到不存在的檔案', (v) => { v.exercises = ['lesson-1/ex-9']; }, /不存在/],
  ['exercises 跨課', (v) => { v.exercises = ['lesson-2/ex-1']; }, /同一課/],
  ['lesson 和檔名不同', (v) => { v.lesson = 2; }, /lesson|課號/],
];
for (const [name, edit, reason] of draftChecked) {
  test('草稿有寫的欄位照常檢查：' + name, async (t) => {
    const f = fixture(t);
    f.front((v) => { draftFront(v); edit(v); }, placeholderBody);
    const errors = await checkContent(f.root);
    assert.ok(errors.some(e => e.file.includes(lessonFile) && reason.test(e.reason)), JSON.stringify(errors));
  });
}
test('草稿沒寫 lesson 時，用檔名的課號檢查 title 和 sidebar.order', async (t) => {
  const f = fixture(t);
  f.front((v) => { draftFront(v); v.sidebar.order = 9; v.title = '第 5 課｜錯的'; }, placeholderBody);
  const errors = await checkContent(f.root);
  assert.ok(errors.some(e => /sidebar.order/.test(e.reason)), JSON.stringify(errors));
  assert.ok(errors.some(e => /title/.test(e.reason)), JSON.stringify(errors));
});
test('草稿的檔名也要是 lesson-N.mdx，課號不補零', async (t) => {
  const f = fixture(t);
  f.front(draftFront, placeholderBody);
  f.move(lessonFile, lessonFile.replace('lesson-1', 'lesson-01'));
  const errors = await checkContent(f.root);
  assert.ok(errors.some(e => e.file.includes('lesson-01') && /檔名/.test(e.reason)), JSON.stringify(errors));
});
test('草稿的課文放了 Exercise 或 Quiz，frontmatter 就要有 exercises、quiz', async (t) => {
  const f = fixture(t);
  f.front(draftFront, placeholderBody + '\n<Exercise id="lesson-1/ex-1" />\n\n<Quiz id="lesson-1/quiz" />\n');
  const errors = await checkContent(f.root);
  assert.ok(errors.some(e => /放了 <Exercise>/.test(e.reason)), JSON.stringify(errors));
  assert.ok(errors.some(e => /放了 <Quiz>/.test(e.reason)), JSON.stringify(errors));
});
test('草稿以外的課文沒有放寬：只有四個欄位時缺少的欄位合成一行', async (t) => {
  const f = fixture(t);
  f.front((v) => { draftFront(v); v.draft = false; }, placeholderBody);
  const errors = await checkContent(f.root);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].reason, /^缺少必填欄位：contract、lesson、minutes、oneThing、result、sources、exercises、quiz、gates$/);
});

// ---- 約定 1.2：錯誤訊息不要連帶、不要一個欄位一行 ----
test('缺少的必填欄位合成一行', async (t) => {
  const f = fixture(t);
  f.front((v) => { delete v.minutes; delete v.oneThing; delete v.result; });
  assert.deepEqual((await checkContent(f.root)).map(e => e.reason), ['缺少必填欄位：minutes、oneThing、result']);
});
test('練習缺少好幾個欄位時也合成一行', async (t) => {
  const f = fixture(t);
  f.data(exerciseFile, (v) => { delete v.title; delete v.goal; });
  const errors = (await checkContent(f.root)).filter(e => e.file.includes(exerciseFile));
  assert.deepEqual(errors.map(e => e.reason), ['缺少必填欄位：title、goal']);
});
test('課文自己格式錯誤時，它的練習和測驗不會連帶被報成「未被引用」', async (t) => {
  const f = fixture(t);
  f.front((v) => { v.minutes = 99; });
  const errors = await checkContent(f.root);
  assert.ok(errors.some(e => /minutes/.test(e.reason)), JSON.stringify(errors));
  assert.ok(!errors.some(e => /未.*引用/.test(e.reason)), JSON.stringify(errors));
});
test('課文的 frontmatter 讀不出來時，也不連帶報練習和測驗沒被引用', async (t) => {
  const f = fixture(t); f.put(lessonFile, '# 沒有設定');
  const errors = await checkContent(f.root);
  assert.ok(errors.some(e => /frontmatter/.test(e.reason)), JSON.stringify(errors));
  assert.ok(!errors.some(e => /未.*引用/.test(e.reason)), JSON.stringify(errors));
});
test('課文沒寫 exercises、quiz 時，已有的練習和測驗檔只報缺欄位，不連帶報沒被引用', async (t) => {
  const f = fixture(t);
  f.front((v) => { delete v.exercises; delete v.quiz; }, placeholderBody);
  assert.deepEqual((await checkContent(f.root)).map(e => e.reason), ['缺少必填欄位：exercises、quiz']);
});
test('analyzeSvg 回傳圖裡的 id，checkSvg 只回傳錯誤', () => {
  assert.deepEqual(analyzeSvg(svg), { errors: [], ids: ['bs-arrow'] });
  assert.deepEqual(checkSvg(svg), []);
  assert.deepEqual(analyzeSvg('<svg>').ids, []);
});
test('同一課兩張圖用同一個 id 會報錯，不同課的圖可以', async (t) => {
  const f = fixture(t);
  const other = 'src/lessons/lesson-1/diagrams/other-diagram.svg';
  f.put(other, svg);
  let errors = await checkContent(f.root);
  assert.ok(errors.some(e => e.file.includes('other-diagram.svg') && /同一課.*bs-arrow.*browser-server\.svg/.test(e.reason)), JSON.stringify(errors));
  assert.ok(!errors.some(e => e.file.includes('/browser-server.svg')), '先出現的那張不該被報錯：' + JSON.stringify(errors));
  f.remove(other);
  f.put('src/lessons/lesson-2/diagrams/other-diagram.svg', svg);
  errors = await checkContent(f.root);
  assert.deepEqual(errors, []);
});

// ---- 約定 1.2.2：沒生效的粗體 ----
// CommonMark 不認結尾前面是標點（全形括號）、後面緊接文字的 **，網頁上會直接顯示 **。
// 第 1 課 Gemini 的原稿開場就是這樣寫（T-010 整合時看畫面才發現）。
const brokenBold = '網頁的三種語言分工：**HTML（超文本標記語言）**管畫面上「有什麼」、**CSS（階層樣式表）**管它們「長什麼樣子」。';
const goodBold = '網頁的三種語言分工：**HTML**（超文本標記語言）管畫面上「有什麼」、**CSS**（階層樣式表）管它們「長什麼樣子」。';
const withText = (text) => validBody + '\n' + text + '\n';
const boldErrors = async (f) => (await checkContent(f.root)).filter(e => /沒生效/.test(e.reason));
const lineNumbers = (errors) => errors.map(e => Number(e.reason.match(/^第 (\d+) 行/)[1]));
// 檔案裡第一個包含 needle 的那一行（從 1 算）
const lineOf = (f, needle) => f.get(lessonFile).split(/\r?\n/).findIndex(line => line.includes(needle)) + 1;
test('粗體只包住詞本身：寫法正確的粗體不報錯', async (t) => {
  const f = fixture(t); f.front(() => {}, withText(goodBold));
  assert.deepEqual(await checkContent(f.root), []);
});
test('結尾的 ** 前面是全形括號、後面緊接中文字：沒生效，報出行號、個數和那段文字', async (t) => {
  const f = fixture(t); f.front(() => {}, withText(brokenBold));
  const errors = await boldErrors(f);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.ok(errors[0].file.includes(lessonFile));
  assert.match(errors[0].reason, new RegExp('^第 ' + lineOf(f, '**HTML（') + ' 行有 4 個沒生效的 \\*\\*'));
  assert.ok(errors[0].reason.includes('**HTML（超文本'), '要附上有問題的那段文字：' + errors[0].reason);
  assert.match(errors[0].reason, /粗體只包住詞本身/);
});
test('第 1 課 Gemini 原稿的開場（三組粗體都沒生效）：一段報一項，個數是 6', async (t) => {
  const f = fixture(t);
  f.front(() => {}, withText('網頁檔案裡最重要的就是三種語言的分工：**HTML（超文本標記語言）**管畫面上「有什麼」、**CSS（階層樣式表）**管它們「長什麼樣子」、**JavaScript（網頁用的程式語言）**管「按下去會怎樣」。這課結束時，你會親手用這三種語言，做出一張卡片。'));
  const errors = await boldErrors(f);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].reason, /^第 \d+ 行有 6 個沒生效的/);
});
test('結尾的 ** 前面是標點、但後面也是標點（全形冒號）：粗體有生效，不報錯', async (t) => {
  const f = fixture(t);
  f.front(() => {}, withText('1. **選擇器（selector）**：大括號前面的 `.card` 就是選擇器。\n2. **CSS 屬性（property）與值**：每一行都用「屬性: 值;」的格式。\n3. **大部分標籤是成對的**：例如 `<h2>`。'));
  assert.deepEqual(await checkContent(f.root), []);
});
test('行內程式碼、程式碼區塊、MDX 註解裡的 **，和作者特地跳脫的 \\*\\*，都不報錯', async (t) => {
  const f = fixture(t);
  f.front(() => {}, withText('用 `**` 包住的是粗體。\n\n```css\n/* ** 註解 ** */\n.card { color: red; }\n```\n\n{/* ** 註解 ** */}\n\n要顯示兩個星號，寫成 \\*\\*。\n\n乘號 3 * 4 和單獨的 * 也不是粗體。'));
  assert.deepEqual(await checkContent(f.root), []);
});
test('跳脫的星號後面又緊接一顆星（\\**）：兩顆星之間沒有粗體的意思，不報錯', async (t) => {
  const f = fixture(t); f.front(() => {}, withText('星號 \\** 在這裡，第一顆是跳脫的。'));
  assert.deepEqual(await checkContent(f.root), []);
  // 前面多一個反斜線（\\ 是反斜線本身）時，後面的 ** 是真的標記；這種寫法太冷門，不處理，也不保證會報
});
test('清單、表格、提示框裡沒生效的粗體也要報，每一處各報一項，行號各自對得上', async (t) => {
  const f = fixture(t);
  f.front(() => {}, withText([
    '1. **清單（說明）**接中文',
    '',
    '| 詞 | 說明 |',
    '|---|---|',
    '| **表格（說明）**接中文 | x |',
    '',
    '<Aside type="tip" title="提示">',
    '',
    '- **提示框（說明）**接中文',
    '',
    '</Aside>',
  ].join('\n')));
  const errors = await boldErrors(f);
  assert.deepEqual(lineNumbers(errors).sort((a, b) => a - b), [lineOf(f, '**清單（'), lineOf(f, '**表格（'), lineOf(f, '**提示框（')]);
});
test('同一段的第二行才有壞的粗體：行號指到那一行，不是段落的第一行', async (t) => {
  const f = fixture(t);
  f.front(() => {}, withText('這一段的第一行沒有問題，\n第二行才有：**詞（說明）**接中文，\n第三行也沒問題。'));
  assert.deepEqual(lineNumbers(await boldErrors(f)), [lineOf(f, '第二行才有')]);
});
test('同一行前面有 emoji（UTF-16 兩個單位）、檔案是 CRLF 換行：行號和附上的文字照樣對', async (t) => {
  const f = fixture(t);
  f.front(() => {}, withText('開頭\n\n😀😀 你好：**詞（說明）**接中文'));
  const expected = lineOf(f, '😀😀');
  f.put(lessonFile, f.get(lessonFile).replace(/\r?\n/g, '\r\n'));
  const errors = await boldErrors(f);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].reason, new RegExp('^第 ' + expected + ' 行有 2 個'));
  assert.ok(errors[0].reason.includes('**詞（說明）**接中'), errors[0].reason);
});
test('草稿課文也檢查沒生效的粗體', async (t) => {
  const f = fixture(t);
  f.front((v) => { v.draft = true; v.gates = { sources: false, review: false, trial: false }; }, withText(brokenBold));
  assert.equal((await boldErrors(f)).length, 1);
});
test('frontmatter 不讀成 Markdown：欄位裡的 ** 不在這條檢查的範圍', async (t) => {
  const f = fixture(t);
  f.front((v) => { v.oneThing = '**HTML（超文本標記語言）**管結構'; }, withText(goodBold));
  assert.deepEqual(await boldErrors(f), []);
});

const invalid = [
  ['練習版本', f => f.data(exerciseFile, v => { v.contract = 99; }), exerciseFile, /contract/],
  ['練習 id 對應路徑', f => f.data(exerciseFile, v => { v.id = 'lesson-2/ex-1'; }), exerciseFile, /id/],
  ['練習不合法欄位', f => f.data(exerciseFile, v => { v.hnit = '錯字'; }), exerciseFile, /格式/],
  ['不合法 YAML', f => f.put(exerciseFile, 'id: [oops'), exerciseFile, /YAML/],
  ['重複 YAML key', f => f.put(exerciseFile, f.get(exerciseFile) + '\nid: lesson-1/ex-1'), exerciseFile, /YAML/],
  ['資料檔命名', f => f.move(exerciseFile, 'src/lessons/lesson-1/other.yaml'), 'other.yaml', /檔名|路徑/],
  ['測驗 id 對應路徑', f => f.data(quizFile, v => { v.id = 'lesson-2/quiz'; }), quizFile, /id/],
  ['測驗版本', f => f.data(quizFile, v => { v.contract = 99; }), quizFile, /contract/],
  ['測驗沒有答案', f => f.data(quizFile, v => v.questions[0].options.forEach(o => { o.correct = false; })), quizFile, /correct/],
  ['測驗兩個答案', f => f.data(quizFile, v => v.questions[0].options.forEach(o => { o.correct = true; })), quizFile, /correct/],
  ['測驗重複題號', f => f.data(quizFile, v => { v.questions[1].id = v.questions[0].id; }), quizFile, /重複/],
  ['測驗缺解析', f => f.data(quizFile, v => { delete v.questions[0].options[0].explain; }), quizFile, /explain/],
  ['frontmatter 格式', f => f.put(lessonFile, '# 沒有設定'), lessonFile, /frontmatter/],
  ['課號不同', f => f.front(v => { v.lesson = 2; }), lessonFile, /lesson|課號/],
  ['課名缺少課號', f => f.front(v => { v.title = '沒有課號'; }), lessonFile, /title/],
  ['課文副檔名', f => f.move(lessonFile, lessonFile.replace('.mdx', '.md')), 'lesson-1.md', /檔名/],
  ['課號補零', f => f.move(lessonFile, lessonFile.replace('lesson-1', 'lesson-01')), 'lesson-01', /檔名/],
  ['側欄順序', f => f.front(v => { v.sidebar.order = 9; }), lessonFile, /sidebar.order/],
  ['draft 型別', f => f.front(v => { v.draft = 'false'; }), lessonFile, /draft/],
  ['公開課未過關', f => f.front(v => { v.gates.review = false; }), lessonFile, /gates/],
  ['課文版本', f => f.front(v => { v.contract = 2; }), lessonFile, /contract/],
  ['來源非 https', f => f.front(v => { v.sources[0].url = 'http://example.org'; }), lessonFile, /sources/],
  ['練習檔不存在', f => f.remove(exerciseFile), lessonFile, /不存在/],
  ['測驗檔不存在', f => f.remove(quizFile), lessonFile, /不存在/],
  ['圖解檔不存在', f => f.remove(svgFile), lessonFile, /SVG.*不存在/],
  ['未使用的練習', f => { const v = example('lesson-1/ex-1'); v.id = 'lesson-1/ex-2'; f.put('src/lessons/lesson-1/ex-2.yaml', stringify(v)); }, 'ex-2.yaml', /未.*引用/],
  ['未使用的測驗', f => { const v = example('lesson-1/quiz'); v.id = 'lesson-2/quiz'; f.put('src/lessons/lesson-2/quiz.yaml', stringify(v)); }, 'lesson-2/quiz.yaml', /未.*引用/],
  ['漏放 Exercise', f => f.front(() => {}, validBody.replace(/<Exercise[^>]+\/>/, '')), lessonFile, /Exercise/],
  ['重複放 Exercise', f => f.front(() => {}, validBody + '\n<Exercise id="lesson-1/ex-1" />'), lessonFile, /Exercise/],
  ['重複 frontmatter 練習', f => f.front(v => v.exercises.push('lesson-1/ex-1')), lessonFile, /重複/],
  ['漏放 Quiz', f => f.front(() => {}, validBody.replace(/<Quiz[^>]+\/>/, '')), lessonFile, /Quiz/],
  ['跨課練習', f => f.front(v => { v.exercises = ['lesson-2/ex-1']; }), lessonFile, /同一課/],
  ['動態 id 不執行', f => f.front(() => {}, validBody.replace('id="lesson-1/ex-1"', 'id={process.exit(0)}')), lessonFile, /字串/],
  ['spread 屬性不能隱藏引用', f => f.front(() => {}, validBody.replace('id="lesson-1/ex-1"', '{...props}')), lessonFile, /靜態|字串/],
  ['Diagram 缺 alt', f => f.front(() => {}, validBody.replace(' alt="瀏覽器與伺服器"', '')), lessonFile, /alt/],
  ['Diagram 路徑跳脫', f => f.front(() => {}, validBody.replace('lesson-1/browser-server', '../outside')), lessonFile, /name/],
  ['SVG 非 XML', f => f.put(svgFile, '<svg><title></svg>'), svgFile, /XML/],
  ['SVG 非根元素', f => f.put(svgFile, '<html/>'), svgFile, /svg/],
  ['SVG namespace', f => f.put(svgFile, svg.replace('http://www.w3.org/2000/svg', 'urn:other')), svgFile, /namespace|xmlns/],
  ['SVG 遺漏 viewBox', f => f.put(svgFile, svg.replace('viewBox="0 0 400 170"', '')), svgFile, /viewBox/],
  ['SVG 太寬', f => f.put(svgFile, svg.replace('0 0 400 170', '0 0 481 170')), svgFile, /viewBox/],
  ['SVG 固定大小', f => f.put(svgFile, svg.replace('<svg ', '<svg width="400" ')), svgFile, /width/],
  ['SVG 缺 title', f => f.put(svgFile, svg.replace(/<title>.*?<\/title>/, '')), svgFile, /title/],
  ['SVG 缺 desc', f => f.put(svgFile, svg.replace(/<desc>.*?<\/desc>/, '')), svgFile, /desc/],
  ['SVG 小字', f => f.put(svgFile, svg.replace('font-size="16"', 'font-size="13"')), svgFile, /14/],
  ['SVG tspan 小字', f => f.put(svgFile, svg.replace('>瀏覽器</text>', '><tspan font-size="10">瀏覽器</tspan></text>')), svgFile, /14/],
  ['SVG style 固定大小', f => f.put(svgFile, svg.replace('<svg ', '<svg style="width: 400px" ')), svgFile, /width/],
  ['SVG 超過八個節點', f => f.put(svgFile, svg.replace('</svg>', '<rect/>'.repeat(9) + '</svg>')), svgFile, /8/],
  ['SVG id 沒前綴', f => f.put(svgFile, svg.replaceAll('bs-arrow', 'arrow')), svgFile, /id/],
  ['SVG 重複 id', f => f.put(svgFile, svg.replace('</svg>', '<g id="bs-arrow"/></svg>')), svgFile, /id/],
  ['SVG fill 寫死', f => f.put(svgFile, svg.replace('<rect ', '<rect fill="red" ')), svgFile, /fill/],
  ['SVG stroke 寫死', f => f.put(svgFile, svg.replace('<rect ', '<rect stroke="#fff" ')), svgFile, /stroke/],
  ['SVG style hex', f => f.put(svgFile, svg.replace('var(--sl-color-text)', '#123abc')), svgFile, /顏色/],
  ['SVG style rgb', f => f.put(svgFile, svg.replace('var(--sl-color-text)', 'rgb(0 0 0)')), svgFile, /顏色/],
  ['SVG style 名稱', f => f.put(svgFile, svg.replace('var(--sl-color-text)', 'rebeccapurple')), svgFile, /顏色/],
  ['SVG 非允許變數', f => f.put(svgFile, svg.replace('var(--sl-color-text)', 'var(--sl-color-white)')), svgFile, /變數/],
  ['SVG var fallback 顏色', f => f.put(svgFile, svg.replace('var(--sl-color-text)', 'var(--sl-color-text, red)')), svgFile, /顏色|變數/],
  ['SVG script', f => f.put(svgFile, svg.replace('</svg>', '<script>alert(1)</script></svg>')), svgFile, /script/],
  ['SVG style 標籤', f => f.put(svgFile, svg.replace('</svg>', '<style>text{fill:red}</style></svg>')), svgFile, /style/],
  ['SVG foreignObject', f => f.put(svgFile, svg.replace('</svg>', '<foreignObject/></svg>')), svgFile, /foreignObject/],
  ['SVG image', f => f.put(svgFile, svg.replace('</svg>', '<image/></svg>')), svgFile, /image/],
  ['SVG 事件', f => f.put(svgFile, svg.replace('<svg ', '<svg onload="alert(1)" ')), svgFile, /事件/],
  ['SVG 外部 href', f => f.put(svgFile, svg.replace('</svg>', '<a href="https://example.org"/></svg>')), svgFile, /外部/],
  ['SVG 外部 xlink', f => f.put(svgFile, svg.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ').replace('</svg>', '<use xlink:href="file:///outside"/></svg>')), svgFile, /外部/],
  ['SVG 外部 style url', f => f.put(svgFile, svg.replace('var(--sl-color-text)', 'url(https://example.org/a.svg)')), svgFile, /外部/],
  ['SVG DTD', f => f.put(svgFile, '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///outside">]>' + svg), svgFile, /DOCTYPE/],
];
for (const field of ['title', 'description', 'sidebar', 'contract', 'lesson', 'minutes', 'oneThing', 'result', 'sources', 'exercises', 'quiz', 'gates', 'draft']) {
  invalid.push(['缺少 ' + field, f => f.front(v => { delete v[field]; }), lessonFile, new RegExp(field)]);
}
// 約定 1.2：圖解是靜態的，不可以有動畫元素；font-size 要能以 viewBox 單位判定
for (const element of ['animate', 'animateColor', 'animateMotion', 'animateTransform', 'set', 'discard']) {
  invalid.push(['SVG 動畫元素 ' + element, f => f.put(svgFile, svg.replace('</svg>', '<' + element + '/></svg>')), svgFile, new RegExp('動畫元素 <' + element + '>')]);
}
invalid.push(['SVG font-size 用 em', f => f.put(svgFile, svg.replace('font-size="16"', 'font-size="1.2em"')), svgFile, /font-size/]);
for (const [name, edit, file, reason] of invalid) {
  test(name, async (t) => {
    const f = fixture(t); edit(f);
    const errors = await checkContent(f.root);
    assert.ok(errors.some(e => e.file.includes(file) && reason.test(e.reason)), JSON.stringify(errors));
  });
}
test('CLI --root 使用指定根目錄，全對回傳 0', (t) => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [cli, '--root', f.root], { encoding: 'utf8', cwd: tmpdir() });
  assert.equal(result.status, 0, result.stderr);
});
test('CLI 失敗回傳 1，每個違規各一行繁體中文', (t) => {
  const f = fixture(t); f.data(quizFile, v => { v.contract = 99; });
  const result = spawnSync(process.execPath, [cli, '--root', f.root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.ok(lines.length > 0);
  assert.ok(lines.every(line => /^錯誤 .+：.+/.test(line)), result.stdout);
  assert.match(result.stdout, /quiz.yaml.*contract/);
});
test('CLI 根目錄不存在時失敗，不能空跑成功', (t) => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [cli, '--root', path.join(f.root, 'absent')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /錯誤/);
});
test('CLI 缺少 --root 值時失敗', () => {
  const result = spawnSync(process.execPath, [cli, '--root'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
});
