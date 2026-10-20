import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeResult } from './sanitize-result.ts';

const ids = ['a', 'b'];

describe('檢查結果的過濾', () => {
  it('正常的結果照原樣收下，順序跟著這個 case 的檢查', () => {
    const out = sanitizeResult({ results: [{ id: 'b', passed: false }, { id: 'a', passed: true }], errors: ['x is not defined'] }, ids);
    assert.deepEqual(out, { results: [{ id: 'a', passed: true }, { id: 'b', passed: false }], errors: ['x is not defined'] });
  });

  it('沒回報的檢查算沒通過', () => {
    assert.deepEqual(sanitizeResult({ results: [{ id: 'a', passed: true }] }, ids).results, [
      { id: 'a', passed: true },
      { id: 'b', passed: false },
    ]);
  });

  it('results 不是陣列、整個訊息是空的或亂的：全部算沒通過，不會出錯', () => {
    for (const bad of [{ results: 'passed' }, { results: { a: true } }, { results: null }, {}, null, undefined, 42, 'x', []]) {
      assert.deepEqual(
        sanitizeResult(bad, ids).results,
        [
          { id: 'a', passed: false },
          { id: 'b', passed: false },
        ],
        JSON.stringify(bad),
      );
    }
  });

  it('不屬於這個 case 的檢查 id 一律忽略', () => {
    const out = sanitizeResult({ results: [{ id: 'zzz', passed: true }, { id: 'a', passed: true }, { id: '__proto__', passed: true }] }, ids);
    assert.deepEqual(out.results, [
      { id: 'a', passed: true },
      { id: 'b', passed: false },
    ]);
  });

  it('passed 不是真正的布林值就算沒通過（"true"、1 都不行）', () => {
    const out = sanitizeResult({ results: [{ id: 'a', passed: 'true' }, { id: 'b', passed: 1 }] }, ids);
    assert.deepEqual(out.results, [
      { id: 'a', passed: false },
      { id: 'b', passed: false },
    ]);
  });

  it('陣列裡混了亂七八糟的東西不會讓它出錯', () => {
    const out = sanitizeResult({ results: [null, 7, 'a', [], { id: 5, passed: true }, { id: 'a', passed: true }] }, ids);
    assert.deepEqual(out.results, [
      { id: 'a', passed: true },
      { id: 'b', passed: false },
    ]);
  });

  it('同一條檢查回報兩次，以第一次為準', () => {
    const out = sanitizeResult({ results: [{ id: 'a', passed: false }, { id: 'a', passed: true }] }, ids);
    assert.equal(out.results[0].passed, false);
  });

  it('錯誤訊息：只收字串、最多 5 則、每則最多 300 字', () => {
    const out = sanitizeResult({ errors: [1, null, 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'x'.repeat(500)] }, ids);
    assert.deepEqual(out.errors, ['e1', 'e2', 'e3', 'e4', 'e5']);
    assert.equal(sanitizeResult({ errors: ['x'.repeat(500)] }, ids).errors[0].length, 300);
    assert.deepEqual(sanitizeResult({ errors: 'oops' }, ids).errors, []);
  });
});
