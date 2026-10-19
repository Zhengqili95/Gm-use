import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { z } from 'astro/zod';
import { CONTRACT_VERSION, exerciseSchema, lessonFrontmatter, quizSchema } from '../schemas.ts';
import { checkSvg } from './svg.mjs';

// Use the MDX parser already selected and locked by Astro. Resolve through its
// dependency owner instead of relying on npm hoisting a transitive dependency.
const astroRequire = createRequire(import.meta.resolve('astro'));
const markdownRequire = createRequire(astroRequire.resolve('@astrojs/markdown-satteri'));
const { mdxToMdast } = await import(pathToFileURL(markdownRequire.resolve('satteri')).href);
const pageSchema = lessonFrontmatter.required().extend({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  sidebar: z.object({ order: z.number().int().min(1) }),
  draft: z.boolean(),
});
const slash = p => p.split(path.sep).join('/');
const clean = value => String(value).replace(/[\r\n\u2028\u2029]+/g, ' ');

function yaml(text) {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map(e => e.message).join('; '));
  return doc.toJS({ maxAliasCount: 100 });
}

/** Read-only validation. root is the project root containing src/. */
export async function checkContent(root) {
  root = path.resolve(root);
  const errors = [];
  const report = (file, reason) => errors.push({ file: clean(file), reason: clean(reason) });
  const load = async file => readFile(path.join(root, file), 'utf8');
  async function walk(dir, skip = () => false) {
    let entries;
    try { entries = await readdir(path.join(root, dir), { withFileTypes: true }); }
    catch (e) { report(dir, '無法讀取內容目錄：' + e.code); return []; }
    const files = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = dir + '/' + entry.name;
      if (skip(file)) continue;
      if (entry.isSymbolicLink()) { report(file, '內容路徑不可使用符號連結'); continue; }
      if (entry.isDirectory()) files.push(...await walk(file, skip));
      else if (entry.isFile()) files.push(file);
    }
    return files;
  }
  async function read(file) {
    try { return await load(file); }
    catch (e) { report(file, '無法讀取檔案：' + e.code); return null; }
  }
  function validate(schema, value, file) {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) {
      const input = issue.path.reduce((part, key) => part?.[key], value);
      const messages = {
        invalid_type: input === undefined ? '缺少必填欄位' : '欄位型別錯誤，預期 ' + issue.expected,
        invalid_value: '必須是允許的值：' + JSON.stringify(issue.values),
        invalid_union: '內容不符合任何允許的格式',
        unrecognized_keys: '含有未定義的欄位：' + (issue.keys ?? []).join('、'),
        too_small: '內容長度、數量或數值不得少於 ' + issue.minimum,
        too_big: '內容長度、數量或數值不得超過 ' + issue.maximum,
        invalid_format: '文字格式錯誤，請依資料格式約定填寫',
      };
      report(file, '格式不符（' + (issue.path.join('.') || '內容') + '）：' + (messages[issue.code] ?? issue.message));
    }
    return null;
  }
  try {
    if (!(await stat(root)).isDirectory()) throw new Error();
  } catch {
    report(slash(root), '內容根目錄不存在或不是資料夾');
    return errors;
  }
  const pages = await walk('src/content/docs/lessons');
  const files = await walk('src/lessons', file => file === 'src/lessons/lesson-0');
  const dataFiles = new Map();
  const diagramFiles = new Set();
  for (const file of files) {
    if (/\.svg$/i.test(file)) {
      const match = file.match(/^src\/lessons\/(lesson-[1-9]\d*)\/diagrams\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.svg$/);
      if (!match) report(file, '圖解檔名或路徑格式錯誤');
      else diagramFiles.add(match[1] + '/' + match[2]);
      const source = await read(file);
      if (source !== null) for (const reason of checkSvg(source)) report(file, reason);
      continue;
    }
    if (!/\.ya?ml$/i.test(file)) continue;
    const match = file.match(/^src\/lessons\/(lesson-[1-9]\d*)\/(ex-[1-9]\d*|quiz)\.yaml$/);
    if (!match) { report(file, '內容檔名或路徑應為 lesson-N/ex-K.yaml 或 lesson-N/quiz.yaml，課號不補零'); continue; }
    const id = match[1] + '/' + match[2];
    dataFiles.set(id, file);
    const source = await read(file);
    if (source === null) continue;
    let value;
    try { value = yaml(source); }
    catch (e) { report(file, 'YAML 解析失敗：' + e.message); continue; }
    validate(match[2] === 'quiz' ? quizSchema : exerciseSchema, value, file);
    if (value?.id !== id) report(file, 'id 必須等於檔案路徑「' + id + '」');
    if (value?.contract !== CONTRACT_VERSION) report(file, 'contract 必須等於 ' + CONTRACT_VERSION);
  }
  const referenced = new Set();
  for (const file of pages) {
    if (!/\.(md|mdx)$/i.test(file)) continue;
    const filename = file.match(/^src\/content\/docs\/lessons\/lesson-([1-9]\d*)\.mdx$/);
    if (!filename) report(file, '課文檔名必須是 lesson-N.mdx，課號不補零');
    const source = await read(file);
    if (source === null) continue;
    const fm = source.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*\r?$(?:\n|$)/m);
    if (!fm || fm.index !== 0) { report(file, '缺少或未關閉 YAML frontmatter'); continue; }
    let value;
    try { value = yaml(fm[1]); }
    catch (e) { report(file, 'frontmatter YAML 解析失敗：' + e.message); continue; }
    const lesson = validate(pageSchema, value, file);
    if (!lesson) continue;
    const lessonId = 'lesson-' + lesson.lesson;
    if (filename && Number(filename[1]) !== lesson.lesson) report(file, '檔名課號必須等於 lesson');
    if (lesson.sidebar.order !== lesson.lesson) report(file, 'sidebar.order 必須等於 lesson');
    if (!new RegExp('^第\\s*' + lesson.lesson + '\\s*課｜.+').test(lesson.title)) report(file, 'title 應為「第 N 課｜課名」且 N 等於 lesson');
    if (!lesson.draft && !Object.values(lesson.gates).every(v => v === true)) report(file, 'draft: false 時 gates 三項必須都是 true');
    if (new Set(lesson.exercises).size !== lesson.exercises.length) report(file, 'exercises 不可重複');
    for (const id of [...lesson.exercises, lesson.quiz]) {
      referenced.add(id);
      if (!id.startsWith(lessonId + '/')) report(file, 'exercises／quiz 必須指向同一課的內容：' + id);
      if (!dataFiles.has(id)) report(file, '引用的內容檔不存在：' + id);
    }
    const actual = { Exercise: [], Quiz: [] };
    let tree;
    try { tree = await mdxToMdast(source.slice(fm[0].length)); }
    catch (e) { report(file, 'MDX 解析失敗：' + e.message); continue; }
    function visit(node) {
      if (['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) &&
          ['Exercise', 'Quiz', 'Diagram'].includes(node.name)) {
        const attr = name => {
          const entries = node.attributes.filter(a => a.type === 'mdxJsxAttribute' && a.name === name);
          if (entries.length !== 1 || typeof entries[0].value !== 'string' || !entries[0].value.trim()) {
            report(file, '<' + node.name + '> 的 ' + name + ' 必須是唯一且非空的靜態字串');
            return null;
          }
          return entries[0].value;
        };
        if (node.attributes.some(a => a.type !== 'mdxJsxAttribute')) report(file, '<' + node.name + '> 不接受展開屬性，引用必須可靜態判定');
        if (node.name === 'Diagram') {
          const name = attr('name');
          attr('alt');
          if (name !== null) {
            if (!/^lesson-[1-9]\d*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) report(file, 'Diagram name 格式錯誤');
            else if (!diagramFiles.has(name)) report(file, 'Diagram 引用的 SVG 檔不存在：' + name);
          }
        } else {
          const id = attr('id');
          if (id !== null) actual[node.name].push(id);
        }
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
    if (JSON.stringify(actual.Exercise) !== JSON.stringify(lesson.exercises)) report(file, '<Exercise id> 必須與 exercises 依序一一對應，不能遺漏、重複或額外引用');
    if (JSON.stringify(actual.Quiz) !== JSON.stringify([lesson.quiz])) report(file, '<Quiz id> 必須與 quiz 一一對應且只出現一次');
  }
  for (const [id, file] of dataFiles) if (!referenced.has(id)) report(file, '內容檔未被任何課文引用：' + id);
  return errors;
}
