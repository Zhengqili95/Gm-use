import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, LOAD_TIMEOUT_MS, TIMEOUT_MS } from './client.mjs';

const exercise = { setup: '', checks: [{ id: 'first' }, { id: 'second' }] };
test('Worker 建立失敗時，保留錯誤並讓全部檢查失敗', async () => {
  const client = createClient(() => { throw new Error('Worker unavailable'); });
  assert.deepEqual(await client.checkSqlExercise(exercise, ''), {
    status: 'error', error: 'Worker unavailable',
    checks: [{ id: 'first', passed: false }, { id: 'second', passed: false }],
  });
});
for (const event of ['error', 'exit', 'post']) test(`Worker ${event} 失敗會清理且不等待逾時`, async () => {
  let onError, onExit, terminated = false;
  const client = createClient(() => ({
    onMessage() {},
    onError(callback) { onError = callback; },
    onExit(callback) { onExit = callback; },
    postMessage() {
      if (event === 'post') throw new Error('cannot post');
      queueMicrotask(() => event === 'error' ? onError(new Error('failed')) : onExit());
    },
    async terminate() { await Promise.resolve(); terminated = true; },
  }));
  const r = await client.checkSqlExercise(exercise, '');
  assert.equal(r.status, 'error');
  assert.ok(r.checks.every(c => !c.passed));
  assert.equal(terminated, true);
});
test('成功回覆也先終止 Worker；結束事件不能覆蓋成功', async () => {
  let onMessage, onExit, terminated = false;
  const client = createClient(() => ({
    onMessage(callback) { onMessage = callback; },
    onError() {},
    onExit(callback) { onExit = callback; },
    postMessage() { queueMicrotask(() => onMessage({ type: 'result', result: { status: 'ok' } })); },
    async terminate() { onExit(); await Promise.resolve(); terminated = true; },
  }));
  assert.deepEqual(await client.runSql('', ''), { status: 'ok' });
  assert.equal(terminated, true);
});

// Timing tests use mock timers so they never really wait 3 s.
function controlledWorker() {
  const worker = { terminated: 0 };
  worker.create = () => ({
    onMessage(callback) { worker.send = callback; },
    onError() {},
    onExit() {},
    postMessage() {},
    async terminate() { worker.terminated++; },
  });
  return worker;
}
async function withFakeTimers(body) {
  mock.timers.enable({ apis: ['setTimeout'] });
  try { await body(); } finally { mock.timers.reset(); }
}
test('載入時間不算進 3 秒：收到 ready 才開始計時', () => withFakeTimers(async () => {
  const worker = controlledWorker();
  const pending = createClient(worker.create).runSql('', 'SELECT 1');
  mock.timers.tick(TIMEOUT_MS + 5000); // Loading outlasts 3 s but is still under the load limit.
  worker.send({ type: 'ready' });
  mock.timers.tick(TIMEOUT_MS - 1); // Still inside the 3 s run budget.
  worker.send({ type: 'result', result: { status: 'ok' } });
  assert.deepEqual(await pending, { status: 'ok' });
  assert.equal(worker.terminated, 1);
}));
test('ready 之後超過 3 秒：逾時、終止 Worker，批改全部失敗', () => withFakeTimers(async () => {
  const worker = controlledWorker();
  const pending = createClient(worker.create).checkSqlExercise(exercise, 'SELECT 1');
  worker.send({ type: 'ready' });
  mock.timers.tick(TIMEOUT_MS);
  assert.deepEqual(await pending, {
    status: 'timeout',
    checks: [{ id: 'first', passed: false }, { id: 'second', passed: false }],
  });
  assert.equal(worker.terminated, 1);
}));
test('一直沒有 ready：載入逾時回 error（不是 timeout），並終止 Worker', () => withFakeTimers(async () => {
  const worker = controlledWorker();
  const pending = createClient(worker.create).checkSqlExercise(exercise, 'SELECT 1');
  mock.timers.tick(LOAD_TIMEOUT_MS);
  const result = await pending;
  assert.equal(result.status, 'error');
  assert.match(result.error, /載入逾時/);
  assert.ok(result.checks.every(c => !c.passed));
  assert.equal(worker.terminated, 1);
}));
test('describeTables 遇到載入逾時：以 SqlExecutionError reject', () => withFakeTimers(async () => {
  const worker = controlledWorker();
  const pending = createClient(worker.create).describeTables('');
  mock.timers.tick(LOAD_TIMEOUT_MS);
  await assert.rejects(pending, { name: 'SqlExecutionError', message: /載入逾時/ });
}));
test('Worker 的訊息格式不對：不認得的忽略，result 沒有內容回 error', () => withFakeTimers(async () => {
  const worker = controlledWorker();
  const pending = createClient(worker.create).runSql('', 'SELECT 1');
  for (const stray of [null, 'garbage', { type: 'other' }]) worker.send(stray);
  worker.send({ type: 'ready' });
  worker.send({ type: 'result' });
  const result = await pending;
  assert.equal(result.status, 'error');
  assert.match(result.error, /格式不正確/);
}));
