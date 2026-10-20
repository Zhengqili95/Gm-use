import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runSql, checkSqlExercise, describeTables } from './run.node.mjs';
import { exerciseSchema } from '../../../lib/schemas.ts';

const contract = readFileSync(new URL('../../../../docs/CONTRACT.md', import.meta.url), 'utf8');
const example = parse(contract.match(/```yaml\r?\n# src\/lessons\/lesson-3\/ex-1.yaml\r?\n([\s\S]*?)```/)[1]);
const setup = "CREATE TABLE t (id INTEGER, label TEXT); INSERT INTO t VALUES (1,'a'),(2,'b'),(2,'b');";
const exercise = (checks, extra = {}) => ({
  ...example, setup, checks: checks.map(c => ({ id: 'result', hint: '請再檢查結果', ...c })), ...extra,
});
const rowCheck = (equals, extra = {}) => ({ type: 'rows', equals, ...extra });
const fixtures = [
  example,
  exercise([rowCheck([[2, 'b'], [2, 'b']], { columns: ['id', 'label'] })],
    { id: 'lesson-3/ex-2', starter: 'SELECT * FROM t;', solution: 'SELECT * FROM t WHERE id=2;' }),
  exercise([rowCheck([[2], [2], [1]], { ordered: true })],
    { id: 'lesson-3/ex-3', starter: 'SELECT id FROM t ORDER BY id;', solution: 'SELECT id FROM t ORDER BY id DESC;' }),
  exercise([{ type: 'state', query: 'SELECT label FROM t WHERE id=3', equals: [['c']] }],
    { id: 'lesson-3/ex-4', starter: "INSERT INTO t VALUES(4,'c');", solution: "INSERT INTO t VALUES(3,'c');" }),
  exercise([{ type: 'state', query: 'SELECT label FROM t WHERE id=1', equals: [['updated']] }],
    { id: 'lesson-3/ex-5', starter: "UPDATE t SET label='wrong' WHERE id=1;", solution: "UPDATE t SET label='updated' WHERE id=1;" }),
];
for (const ex of fixtures) test(`驗收練習 ${ex.id}：答案通過、起始內容未過`, async () => {
  exerciseSchema.parse(ex);
  const answer = await checkSqlExercise(ex, ex.solution);
  assert.equal(answer.status, 'ok');
  assert.equal(answer.checks.length, ex.checks.length);
  assert.ok(answer.checks.every(c => c.passed));
  const start = await checkSqlExercise(ex, ex.starter);
  assert.equal(start.status, 'ok');
  assert.ok(start.checks.some(c => !c.passed));
});

const comparisons = [
  ['數值 1 與 1.0', 'SELECT 1.0', [[1]], {}, true],
  ['數字與文字不同', "SELECT '1'", [[1]], {}, false],
  ['null 相同', 'SELECT NULL', [[null]], {}, true],
  ['null 不等於空字串', "SELECT ''", [[null]], {}, false],
  ['文字區分大小寫', "SELECT 'A'", [['a']], {}, false],
  ['文字保留空白', "SELECT 'a '", [['a']], {}, false],
  ['欄名大小寫相同', 'SELECT 1 AS Title', [[1]], { columns: ['Title'] }, true],
  ['欄名大小寫不同', 'SELECT 1 AS Title', [[1]], { columns: ['title'] }, false],
  ['欄名順序', 'SELECT 1 AS x, 2 AS y', [[1,2]], { columns: ['y','x'] }, false],
  ['預設忽略順序', 'SELECT id FROM t ORDER BY id DESC', [[1],[2],[2]], {}, true],
  ['多重集合不丟重複列', 'SELECT id FROM t', [[1],[1],[2]], {}, false],
  ['ordered 成功', 'SELECT id FROM t ORDER BY id DESC', [[2],[2],[1]], { ordered: true }, true],
  ['ordered 失敗', 'SELECT id FROM t ORDER BY id DESC', [[1],[2],[2]], { ordered: true }, false],
  ['空 SELECT 是空結果', 'SELECT id FROM t WHERE 0', [], {}, true],
  ['沒有結果集不等於空結果', 'UPDATE t SET id=id', [], {}, false],
  ['空程式不算結果集', '-- comment', [], {}, false],
  ['不同列長度不相等', 'SELECT 1, 2', [[1]], {}, false],
  ['無限大不是 null', 'SELECT 1e999', [[null]], {}, false],
];
for (const [name, sql, equals, options, expected] of comparisons) test(name, async () => {
  const result = await checkSqlExercise(exercise([rowCheck(equals, options)]), sql);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.checks, [{ id: 'result', passed: expected }]);
});

test('多語句：取最後的 SELECT，後續 UPDATE 不覆蓋它', async () => {
  const r = await runSql(setup, "SELECT 99; UPDATE t SET label='x'; SELECT label FROM t WHERE id=1; INSERT INTO t VALUES (4,'d');");
  assert.deepEqual(r, { status: 'ok', resultSet: { columns: ['label'], rows: [['x']], truncated: false } });
});
test('最後 SELECT 零列仍覆蓋前次結果', async () => {
  assert.deepEqual((await runSql(setup, 'SELECT 1; SELECT id FROM t WHERE 0')).resultSet,
    { columns: ['id'], rows: [], truncated: false });
});
test('不能以分號切字串，DDL 後的語句要能使用新表', async () => {
  assert.deepEqual((await runSql('', "CREATE TABLE x(a); INSERT INTO x VALUES('a;b'); SELECT * FROM x;")).resultSet?.rows, [['a;b']]);
});
const sequence = n => `WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<${n}) SELECT x FROM n`;
for (const n of [100, 101, 130]) test(`顯示上限100列：實際 ${n} 列`, async () => {
  const r = await runSql('', sequence(n));
  assert.equal(r.resultSet?.rows.length, Math.min(100, n));
  assert.equal(r.resultSet?.truncated, n > 100);
});
test('批改完整結果，不能只拿畫面的前100列當全部', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => [i+1]);
  assert.equal((await checkSqlExercise(exercise([rowCheck(rows)]), sequence(101))).checks[0].passed, true);
  assert.equal((await checkSqlExercise(exercise([rowCheck(rows.slice(0,100))]), sequence(101))).checks[0].passed, false);
});
test('state 在全部學習者語句完成後檢查，維持 checks 順序', async () => {
  const r = await checkSqlExercise(exercise([
    { id: 'first', type: 'state', query: 'SELECT label FROM t WHERE id=1', equals: [['z']] },
    { id: 'second', ...rowCheck([[1]]) },
  ]), "SELECT 1; UPDATE t SET label='z' WHERE id=1");
  assert.deepEqual(r.checks, [{ id: 'first', passed: true }, { id: 'second', passed: true }]);
});
for (const [name, sql, error] of [
  ['語法錯誤', 'SELEC 1', /syntax/i],
  ['不存在欄位', 'SELECT missing FROM t', /no such column/i],
  ['後面的語句出錯', 'SELECT 1; SELECT missing FROM t', /no such column/i],
]) test(name, async () => {
  const r = await checkSqlExercise(exercise([rowCheck([[1]]), { id: 'other', ...rowCheck([[1]]) }]), sql);
  assert.equal(r.status, 'error');
  assert.match(r.error, error);
  assert.ok(r.checks.every(c => !c.passed));
  assert.equal(r.resultSet, undefined);
});
test('setup 或 state query 出錯，所有檢查失敗', async () => {
  for (const ex of [
    exercise([rowCheck([[1]])], { setup: 'BROKEN' }),
    exercise([rowCheck([[1]]), { id: 'bad', type: 'state', query: 'SELECT missing', equals: [] }]),
  ]) {
    const r = await checkSqlExercise(ex, 'SELECT 1');
    assert.equal(r.status, 'error');
    assert.equal(r.checks.length, ex.checks.length);
    assert.ok(r.checks.every(c => !c.passed));
  }
});
test('每次呼叫和同時呼叫皆隔離，不保留修改', async () => {
  await runSql(setup, 'DELETE FROM t');
  const results = await Promise.all([runSql(setup, 'SELECT count(*) FROM t'), runSql(setup, 'SELECT count(*) FROM t')]);
  results.forEach(r => assert.deepEqual(r.resultSet?.rows, [[3]]));
});
test('describeTables 列全部使用者表、欄位與前5列，包含空表和引號表名', async () => {
  const tables = await describeTables(`CREATE TABLE "a""b" (x, y); CREATE TABLE empty (id INTEGER PRIMARY KEY AUTOINCREMENT);
    INSERT INTO "a""b" VALUES (1,NULL),(2,'b'),(3,'c'),(4,'d'),(5,'e'),(6,'f');`);
  assert.deepEqual(tables, [
    { name: 'a"b', columns: ['x','y'], rows: [[1,null],[2,'b'],[3,'c'],[4,'d'],[5,'e']] },
    { name: 'empty', columns: ['id'], rows: [] },
  ]);
});
test('describeTables 錯誤會 reject，不假裝沒有資料表', async () => {
  await assert.rejects(describeTables('BROKEN'), /syntax/i);
});
test('describeTables 不把 sqliteX 當作 sqlite_ 系統表排除', async () => {
  assert.deepEqual(await describeTables('CREATE TABLE sqliteX (id);'),
    [{ name: 'sqliteX', columns: ['id'], rows: [] }]);
});
test('state 也支援 ordered 與空結果，不回傳資料的 query 不通過', async () => {
  const r = await checkSqlExercise(exercise([
    { id: 'ordered', type: 'state', query: 'SELECT id FROM t ORDER BY id DESC', equals: [[2],[2],[1]], ordered: true },
    { id: 'empty', type: 'state', query: 'SELECT id FROM t WHERE 0', equals: [] },
    { id: 'none', type: 'state', query: 'UPDATE t SET id=id', equals: [] },
  ]), 'SELECT 1');
  assert.deepEqual(r.checks, [
    { id: 'ordered', passed: true }, { id: 'empty', passed: true }, { id: 'none', passed: false },
  ]);
});
test('RETURNING 超過100列仍執行完全部寫入', async () => {
  const r = await checkSqlExercise(exercise([
    { type: 'state', query: 'SELECT count(*) FROM t', equals: [[104]] },
  ]), `INSERT INTO t(id) ${sequence(101)} RETURNING id`);
  assert.equal(r.status, 'ok');
  assert.equal(r.resultSet.truncated, true);
  assert.equal(r.checks[0].passed, true);
});
test('無窮遞迴約3秒終止，所有檢查失敗，下一次仍正常', { timeout: 12000 }, async () => {
  const began = performance.now();
  const r = await checkSqlExercise(exercise([rowCheck([[1]])]),
    'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n');
  assert.equal(r.status, 'timeout');
  assert.deepEqual(r.checks, [{ id: 'result', passed: false }]);
  assert.ok(performance.now() - began < 4500);
  assert.deepEqual((await runSql('', 'SELECT 42')).resultSet?.rows, [[42]]);
});
