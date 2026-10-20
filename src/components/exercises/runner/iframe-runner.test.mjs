// 檢查執行器裡的迴圈保護（__vlLoop）：不開瀏覽器，用假的 window、假的時間在 Node 裡測。
// 真正在瀏覽器裡的行為，由 npm run test:exercises 和手動驗證負責。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';

import { LOOP_ABORT_MARK } from './guard-loops.ts';

const source = readFileSync(new URL('./iframe-runner.js', import.meta.url), 'utf8');

let now;
let taskEnds; // 還沒送出的「任務結束」訊號

function loadRunner({ withChannel = true } = {}) {
  const win = { parent: { postMessage() {} }, addEventListener() {} };
  taskEnds = [];
  class FakeChannel {
    constructor() {
      this.port1 = {};
      this.port2 = { postMessage: () => taskEnds.push(() => this.port1.onmessage()) };
    }
  }
  const fakeSetTimeout = (callback) => taskEnds.push(callback);
  const fakeDate = { now: () => now };
  new Function('window', 'document', 'MessageChannel', 'setTimeout', 'Date', source)(win, {}, withChannel ? FakeChannel : undefined, fakeSetTimeout, fakeDate);
  return win.__vlLoop;
}
const endTask = () => taskEnds.splice(0).forEach((signal) => signal());

describe('迴圈保護（__vlLoop）', () => {
  beforeEach(() => {
    now = 1_000_000;
  });

  it('同一個任務裡跑不到 1 秒：不丟錯誤', () => {
    const guard = loadRunner();
    guard(0);
    now += 1000;
    assert.doesNotThrow(() => guard(0));
  });

  it('同一個任務裡超過 1 秒：丟錯誤，訊息說明是迴圈跑太久', () => {
    const guard = loadRunner();
    guard(0);
    now += 1001;
    assert.throws(() => guard(0), /迴圈跑太久了/);
  });

  it('錯誤訊息一定包含畫面用來認出迴圈保護的那段字（LOOP_ABORT_MARK）', () => {
    const guard = loadRunner();
    guard();
    now += 1001;
    assert.throws(() => guard(), (error) => error.message.includes(LOOP_ABORT_MARK));
    assert.ok(source.includes(LOOP_ABORT_MARK));
  });

  it('不管是哪個迴圈：一個任務的時間是大家合起來算的（巢狀迴圈、try/catch 吞掉錯誤都躲不掉）', () => {
    const guard = loadRunner();
    guard(0);
    now += 600;
    guard(1);
    now += 600;
    assert.throws(() => guard(2), /迴圈跑太久了/);
    assert.throws(() => guard(0), /迴圈跑太久了/); // 被吞掉之後再呼叫，還是丟錯誤
  });

  it('任務結束（讓出給瀏覽器）之後重新計時', () => {
    const guard = loadRunner();
    guard(0);
    now += 900;
    endTask();
    now += 5000; // 中間隔了很久也沒關係：這是新的任務
    assert.doesNotThrow(() => guard(0));
    now += 900;
    assert.doesNotThrow(() => guard(0));
    now += 200;
    assert.throws(() => guard(0), /迴圈跑太久了/);
  });

  it('沒有 MessageChannel 的環境：退回用 setTimeout 當任務結束的訊號', () => {
    const guard = loadRunner({ withChannel: false });
    guard(0);
    now += 2000;
    assert.throws(() => guard(0), /迴圈跑太久了/);
    endTask();
    assert.doesNotThrow(() => guard(0));
  });
});
