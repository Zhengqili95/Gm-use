import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectOutcomes, groupBySteps } from './group-checks.ts';

const click = [{ click: '#fav' }];
const check = (id, steps) => ({ id, type: 'text', selector: '#x', equals: 'a', hint: 'h', ...(steps ? { steps } : {}) });
const pass = (checks) => checks.map((c) => ({ id: c.id, passed: true }));

describe('檢查分組', () => {
  it('steps 相同的檢查放同一組，沒有 steps 的自成一組', () => {
    const groups = groupBySteps([check('a'), check('b', click), check('c', click), check('d')]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0].checks.map((c) => c.id), ['a', 'd']);
    assert.deepEqual(groups[1].checks.map((c) => c.id), ['b', 'c']);
    assert.deepEqual(groups[1].steps, click);
  });

  it('steps 不一樣就分成不同的 case', () => {
    const groups = groupBySteps([check('a', [{ click: '#a' }]), check('b', [{ click: '#b' }])]);
    assert.equal(groups.length, 2);
  });
});

describe('依序跑完所有 case', () => {
  it('每個 case 各跑一次，結果合併，錯誤去掉重複', async () => {
    const calls = [];
    const outcome = await collectOutcomes({}, [check('a'), check('b', click), check('c', click)], async (_files, steps, checks) => {
      calls.push(steps.length);
      return { results: pass(checks), errors: ['同一個錯誤'], timedOut: false };
    });
    assert.deepEqual(calls, [0, 1]);
    assert.deepEqual([...outcome.passed], [['a', true], ['b', true], ['c', true]]);
    assert.deepEqual(outcome.errors, ['同一個錯誤']);
    assert.equal(outcome.timedOut, false);
  });

  it('沒有操作的 case 就逾時：後面的 case 直接算失敗，不用再各等一次', async () => {
    let calls = 0;
    const outcome = await collectOutcomes({}, [check('a'), check('b', click)], async (_files, _steps, checks) => {
      calls++;
      return { results: checks.map((c) => ({ id: c.id, passed: false })), errors: [], timedOut: true };
    });
    assert.equal(calls, 1);
    assert.equal(outcome.timedOut, true);
    assert.deepEqual([...outcome.passed], [['a', false], ['b', false]]);
  });

  it('有操作的 case 逾時：其他 case 還是會跑（卡住的只是按下去之後的程式）', async () => {
    const seen = [];
    const outcome = await collectOutcomes(
      {},
      [check('a', [{ click: '#a' }]), check('b', [{ click: '#b' }])],
      async (_files, steps, checks) => {
        seen.push(steps[0].click);
        const hang = steps[0].click === '#a';
        return { results: checks.map((c) => ({ id: c.id, passed: !hang })), errors: [], timedOut: hang };
      },
    );
    assert.deepEqual(seen, ['#a', '#b']);
    assert.equal(outcome.timedOut, true);
    assert.deepEqual([...outcome.passed], [['a', false], ['b', true]]);
  });
});
