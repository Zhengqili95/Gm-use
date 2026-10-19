import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canReveal, initialFlow, isDone, reduce } from './flow.ts';

const check = (flow, passed) => reduce(flow, { type: 'check', passed });
const hint = (flow) => reduce(flow, { type: 'hint' });
const reveal = (flow) => reduce(flow, { type: 'reveal' });

describe('答題流程', () => {
  it('一開始是 todo，不能看答案', () => {
    assert.equal(initialFlow.status, 'todo');
    assert.equal(canReveal(initialFlow), false);
    assert.equal(isDone(initialFlow), false);
  });

  it('檢查沒通過：變成 attempted，失敗次數加一', () => {
    const next = check(initialFlow, false);
    assert.equal(next.status, 'attempted');
    assert.equal(next.failedAttempts, 1);
  });

  it('檢查通過：變成 passed，算完成', () => {
    const next = check(initialFlow, true);
    assert.equal(next.status, 'passed');
    assert.equal(isDone(next), true);
  });

  it('提示一層一層展開，最多三層', () => {
    let flow = initialFlow;
    for (const expected of [1, 2, 3, 3, 3]) {
      flow = hint(flow);
      assert.equal(flow.hintsShown, expected);
    }
  });

  it('三層提示都看過之後，才可以看答案', () => {
    let flow = hint(hint(initialFlow));
    assert.equal(canReveal(flow), false);
    flow = hint(flow);
    assert.equal(canReveal(flow), true);
  });

  it('不看提示，檢查失敗滿 3 次也可以看答案', () => {
    let flow = initialFlow;
    for (let i = 0; i < 2; i++) flow = check(flow, false);
    assert.equal(canReveal(flow), false);
    flow = check(flow, false);
    assert.equal(canReveal(flow), true);
  });

  it('還不能看答案時按「看答案」沒有作用', () => {
    assert.equal(reveal(initialFlow).revealShown, false);
  });

  it('看過答案之後才通過：算 revealed，也算完成', () => {
    let flow = hint(hint(hint(initialFlow)));
    flow = reveal(flow);
    assert.equal(flow.revealShown, true);
    flow = check(flow, true);
    assert.equal(flow.status, 'revealed');
    assert.equal(isDone(flow), true);
  });

  it('已經通過之後再檢查沒通過，狀態不會退回去', () => {
    const passed = check(initialFlow, true);
    assert.equal(check(passed, false).status, 'passed');
  });

  it('attempts 記的是按「檢查」的總次數（通過和沒通過都算），failedAttempts 只算沒通過的', () => {
    let flow = check(initialFlow, false);
    flow = check(flow, false);
    flow = check(flow, true);
    assert.equal(flow.attempts, 3);
    assert.equal(flow.failedAttempts, 2);
  });

  it('還原：用儲存的進度取代目前的狀態', () => {
    const saved = { status: 'attempted', attempts: 4, failedAttempts: 4, hintsShown: 2, revealShown: false };
    const flow = reduce(initialFlow, { type: 'restore', flow: saved });
    assert.deepEqual(flow, saved);
    assert.equal(canReveal(flow), true); // 失敗滿 3 次，還原後仍然可以看答案
  });
});