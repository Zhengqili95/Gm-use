// 進度儲存的測試：用一個假的 localStorage，在 Node 裡跑。
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    raw: data,
  };
}

globalThis.localStorage = fakeStorage();
const store = await import('./progress-store.ts');

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
  store.__resetCacheForTests();
});

describe('進度儲存', () => {
  it('一開始是空的', () => {
    assert.deepEqual(store.getProgress(), { schema: 1, lessons: {} });
    assert.equal(store.getExercise('lesson-1/ex-1'), undefined);
  });

  it('更新練習：補上預設值、記下時間，並寫進 localStorage', () => {
    const saved = store.updateExercise('lesson-1/ex-1', { status: 'attempted', failedAttempts: 1, files: { 'index.html': '<p>a</p>' } });
    assert.equal(saved.status, 'attempted');
    assert.equal(saved.hintsShown, 0);
    assert.equal(saved.revealShown, false);
    assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
    const raw = JSON.parse(globalThis.localStorage.getItem(store.STORAGE_KEY));
    assert.equal(raw.schema, 1);
    assert.equal(raw.lessons['lesson-1'].exercises['lesson-1/ex-1'].files['index.html'], '<p>a</p>');
  });

  it('同一課的練習放在同一個地方，不同課分開', () => {
    store.updateExercise('lesson-1/ex-1', { status: 'passed' });
    store.updateExercise('lesson-1/ex-2', { status: 'attempted' });
    store.updateExercise('lesson-2/ex-1', { status: 'todo' });
    const lessons = store.getProgress().lessons;
    assert.deepEqual(Object.keys(lessons).sort(), ['lesson-1', 'lesson-2']);
    assert.deepEqual(Object.keys(lessons['lesson-1'].exercises).sort(), ['lesson-1/ex-1', 'lesson-1/ex-2']);
  });

  it('再更新一次：只改有給的欄位，其他保留', () => {
    store.updateExercise('lesson-1/ex-1', { status: 'attempted', hintsShown: 2, attempts: 3 });
    store.updateExercise('lesson-1/ex-1', { status: 'passed' });
    const ex = store.getExercise('lesson-1/ex-1');
    assert.equal(ex.status, 'passed');
    assert.equal(ex.hintsShown, 2);
    assert.equal(ex.attempts, 3);
  });

  it('lastFailedCheck 可以被清掉', () => {
    store.updateExercise('lesson-1/ex-1', { lastFailedCheck: { id: 'a', hint: 'h' } });
    assert.deepEqual(store.getExercise('lesson-1/ex-1').lastFailedCheck, { id: 'a', hint: 'h' });
    store.updateExercise('lesson-1/ex-1', { lastFailedCheck: undefined });
    assert.equal('lastFailedCheck' in store.getExercise('lesson-1/ex-1'), false);
  });

  it('重新載入（清掉記憶體快取）之後，還讀得到存起來的進度', () => {
    store.updateExercise('lesson-1/ex-1', { status: 'passed', files: { 'script.js': 'x' } });
    store.__resetCacheForTests();
    assert.equal(store.getExercise('lesson-1/ex-1').status, 'passed');
    assert.equal(store.getExercise('lesson-1/ex-1').files['script.js'], 'x');
  });

  it('儲存的內容壞掉或格式不對：當作沒有進度，不丟例外', () => {
    for (const bad of ['{不是 JSON', '123', '{"schema":2,"lessons":{}}', '{"schema":1}', 'null']) {
      globalThis.localStorage.setItem(store.STORAGE_KEY, bad);
      store.__resetCacheForTests();
      assert.deepEqual(store.getProgress(), { schema: 1, lessons: {} }, `壞掉的內容：${bad}`);
    }
  });

  it('localStorage 用不了（讀寫都丟例外）：退回記憶體，不丟例外', () => {
    const broken = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('QuotaExceededError'); },
    };
    globalThis.localStorage = broken;
    store.__resetCacheForTests();
    store.updateExercise('lesson-1/ex-1', { status: 'passed' });
    assert.equal(store.getExercise('lesson-1/ex-1').status, 'passed');
  });

  it('完全沒有 localStorage（例如伺服器端渲染）：也不丟例外', () => {
    delete globalThis.localStorage;
    store.__resetCacheForTests();
    assert.deepEqual(store.getProgress(), { schema: 1, lessons: {} });
    store.updateExercise('lesson-1/ex-1', { status: 'attempted' });
    assert.equal(store.getExercise('lesson-1/ex-1').status, 'attempted');
  });

  it('有改動時通知訂閱的人，取消訂閱之後就不通知', () => {
    const seen = [];
    const unsubscribe = store.subscribe((state) => seen.push(Object.keys(state.lessons)));
    store.updateExercise('lesson-1/ex-1', { status: 'passed' });
    store.updateExercise('lesson-2/ex-1', { status: 'passed' });
    unsubscribe();
    store.updateExercise('lesson-3/ex-1', { status: 'passed' });
    assert.deepEqual(seen, [['lesson-1'], ['lesson-1', 'lesson-2']]);
  });

  it('測驗的答題紀錄', () => {
    store.updateQuiz('lesson-1', 'q1', { firstTryCorrect: true, tries: 1, done: true });
    store.updateQuiz('lesson-1', 'q2', { tries: 1 });
    store.updateQuiz('lesson-1', 'q2', { tries: 2, done: true });
    assert.deepEqual(store.getProgress().lessons['lesson-1'].quiz.answers, {
      q1: { firstTryCorrect: true, tries: 1, done: true },
      q2: { firstTryCorrect: false, tries: 2, done: true },
    });
  });

  it('reset 清掉全部進度', () => {
    store.updateExercise('lesson-1/ex-1', { status: 'passed' });
    store.reset();
    assert.deepEqual(store.getProgress(), { schema: 1, lessons: {} });
    assert.equal(JSON.parse(globalThis.localStorage.getItem(store.STORAGE_KEY)).lessons['lesson-1'], undefined);
  });
});
