// 測驗的計分和答題規則的測試（docs/CONTRACT.md B6）：直接用 Node 跑，不開瀏覽器。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyPick, scoreOf, shuffledOrder } from './quiz-logic.ts';

const right = { text: '對的', correct: true, explain: '對' };
const wrong = { text: '錯的', explain: '錯' };

describe('選項打亂', () => {
  it('每個位置剛好出現一次，不管 random 給什麼', () => {
    for (const random of [() => 0, () => 0.5, () => 0.999999, () => 1, Math.random]) {
      for (const length of [0, 1, 2, 3, 4]) {
        const order = shuffledOrder(length, random);
        assert.deepEqual([...order].sort(), Array.from({ length }, (_, i) => i), `length=${length}`);
      }
    }
  });

  it('隨機數固定時，結果是可預期的', () => {
    assert.deepEqual(shuffledOrder(4, () => 0), [1, 2, 3, 0]);
    // random 永遠給最大值：每一步都換到自己身上，順序不變
    assert.deepEqual(shuffledOrder(4, () => 0.9999), [0, 1, 2, 3]);
  });

  it('真的會打亂：跑很多次，每個位置都出現過在最前面', () => {
    const firsts = new Set();
    for (let i = 0; i < 200; i++) firsts.add(shuffledOrder(3)[0]);
    assert.deepEqual([...firsts].sort(), [0, 1, 2]);
  });
});

describe('點選項（applyPick）', () => {
  it('第一次就點對：得分、完成', () => {
    assert.deepEqual(applyPick(undefined, right, 0), { firstTryCorrect: true, tries: 1, done: true, picked: [0] });
  });

  it('先點錯、再點對：完成，但不算第一次就答對', () => {
    const first = applyPick(undefined, wrong, 1);
    assert.deepEqual(first, { firstTryCorrect: false, tries: 1, done: false, picked: [1] });
    const second = applyPick(first, right, 0);
    assert.deepEqual(second, { firstTryCorrect: false, tries: 2, done: true, picked: [1, 0] });
  });

  it('點兩個錯的才點對：嘗試次數是 3', () => {
    let answer = applyPick(undefined, wrong, 2);
    answer = applyPick(answer, wrong, 1);
    answer = applyPick(answer, right, 0);
    assert.equal(answer.tries, 3);
    assert.equal(answer.firstTryCorrect, false);
    assert.deepEqual(answer.picked, [2, 1, 0]);
  });

  it('再點同一個已經點過的選項：沒有變化（傳回 null），不多算一次嘗試', () => {
    const first = applyPick(undefined, wrong, 1);
    assert.equal(applyPick(first, wrong, 1), null);
    const done = applyPick(first, right, 0);
    assert.equal(applyPick(done, right, 0), null);
    assert.equal(applyPick(done, wrong, 1), null);
  });

  it('答對之後再點別的選項：只是看說明，記下來但不改計分', () => {
    const done = applyPick(undefined, right, 0);
    const reviewed = applyPick(done, wrong, 2);
    assert.deepEqual(reviewed, { firstTryCorrect: true, tries: 1, done: true, picked: [0, 2] });
  });

  it('答對之後再看別的選項，不會把「第一次沒答對」改成答對', () => {
    const wrongFirst = applyPick(undefined, wrong, 1);
    const done = applyPick(wrongFirst, right, 0);
    const reviewed = applyPick(done, right, 3);
    assert.equal(reviewed.firstTryCorrect, false);
    assert.equal(reviewed.tries, 2);
  });

  it('不改動傳進來的紀錄', () => {
    const before = Object.freeze({ firstTryCorrect: false, tries: 1, done: false, picked: Object.freeze([1]) });
    const after = applyPick(before, right, 0);
    assert.deepEqual(before.picked, [1]);
    assert.deepEqual(after.picked, [1, 0]);
  });
});

describe('計分（scoreOf）', () => {
  const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];

  it('一題都還沒答：0 分、還沒完成', () => {
    assert.deepEqual(scoreOf(questions, {}), { firstTry: 0, done: 0, total: 3, complete: false });
  });

  it('只算第一次就答對的；答對（done）和得分是兩回事', () => {
    const answers = {
      q1: { firstTryCorrect: true, tries: 1, done: true },
      q2: { firstTryCorrect: false, tries: 2, done: true },
      q3: { firstTryCorrect: false, tries: 1, done: false },
    };
    assert.deepEqual(scoreOf(questions, answers), { firstTry: 1, done: 2, total: 3, complete: false });
  });

  it('每一題都答對才算完成', () => {
    const answers = {
      q1: { firstTryCorrect: true, tries: 1, done: true },
      q2: { firstTryCorrect: false, tries: 3, done: true },
      q3: { firstTryCorrect: true, tries: 1, done: true },
    };
    assert.deepEqual(scoreOf(questions, answers), { firstTry: 2, done: 3, total: 3, complete: true });
  });

  it('沒答對的題目，就算 firstTryCorrect 寫 true 也不得分（防止被改壞的進度）', () => {
    assert.equal(scoreOf(questions, { q1: { firstTryCorrect: true, tries: 1, done: false } }).firstTry, 0);
  });

  it('不在這份測驗裡的題目 id 不算', () => {
    const answers = { q9: { firstTryCorrect: true, tries: 1, done: true } };
    assert.deepEqual(scoreOf(questions, answers), { firstTry: 0, done: 0, total: 3, complete: false });
  });

  it('沒有題目的測驗不算完成', () => {
    assert.equal(scoreOf([], {}).complete, false);
  });
});
