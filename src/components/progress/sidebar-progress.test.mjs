// 側邊欄進度的純函式測試：課號從網址取出、哪幾課完成、清單的格式檢查。
// 畫面（更新 DOM）的部分要在瀏覽器裡驗證。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lessonIdFromPath, newlyDone, parseManifest, summarize } from './sidebar-progress.ts';

const done = { status: 'passed', attempts: 1, failedAttempts: 0, hintsShown: 0, revealShown: false, files: {}, updatedAt: '' };
const manifest = {
  'lesson-1': { exercises: ['lesson-1/ex-1'], questions: ['q1', 'q2'] },
  'lesson-2': { exercises: [], questions: [] }, // 還沒做好的佔位頁
  'lesson-3': { exercises: ['lesson-3/ex-1'], questions: ['q1'] },
};
const lesson1Done = {
  exercises: { 'lesson-1/ex-1': done },
  quiz: { answers: { q1: { firstTryCorrect: true, tries: 1, done: true }, q2: { firstTryCorrect: false, tries: 2, done: true } } },
};

describe('課號從網址取出', () => {
  it('有 base 的課程網址', () => {
    assert.equal(lessonIdFromPath('/Gm-use/lessons/lesson-1/'), 'lesson-1');
    assert.equal(lessonIdFromPath('/Gm-use/lessons/lesson-12'), 'lesson-12');
    assert.equal(lessonIdFromPath('/lessons/lesson-3/'), 'lesson-3');
  });

  it('不是課程頁的網址傳回 null', () => {
    for (const path of ['/Gm-use/', '/Gm-use/dev/lab/', '/Gm-use/lessons/', '/Gm-use/lessons/lesson-0/', '/Gm-use/lessons/lesson-1/extra/', '/Gm-use/lessons/lesson-x/']) {
      assert.equal(lessonIdFromPath(path), null, path);
    }
  });
});

describe('側邊欄進度的摘要（summarize）', () => {
  it('什麼都還沒做：0 課', () => {
    const summary = summarize(['lesson-1', 'lesson-2', 'lesson-3'], 3, { schema: 1, lessons: {} }, manifest);
    assert.deepEqual(summary, { doneIds: [], label: '0 / 3 課', percent: 0 });
  });

  it('第 1 課完成：1 / 3 課、進度條 33%', () => {
    const summary = summarize(['lesson-1', 'lesson-2', 'lesson-3'], 3, { schema: 1, lessons: { 'lesson-1': lesson1Done } }, manifest);
    assert.deepEqual(summary, { doneIds: ['lesson-1'], label: '1 / 3 課', percent: 33 });
  });

  it('只上線一課時，分母只算已經上線的課（總課數由側邊欄給）：完成就是 1 / 1 課、100%', () => {
    const summary = summarize(['lesson-1'], 1, { schema: 1, lessons: { 'lesson-1': lesson1Done } }, manifest);
    assert.deepEqual(summary, { doneIds: ['lesson-1'], label: '1 / 1 課', percent: 100 });
  });

  it('清單裡沒有的課、還沒做好的課（沒有練習）都不算完成', () => {
    const state = { schema: 1, lessons: { 'lesson-1': lesson1Done, 'lesson-2': { exercises: {} } } };
    assert.deepEqual(summarize(['lesson-2'], 3, state, manifest).doneIds, []);
    assert.deepEqual(summarize(['lesson-1'], 3, state, {}).doneIds, []);
  });

  it('總課數讀不出來（0 或 NaN）：改用側邊欄裡的課數', () => {
    assert.equal(summarize(['lesson-1', 'lesson-2'], 0, { schema: 1, lessons: {} }, manifest).label, '0 / 2 課');
    assert.equal(summarize(['lesson-1', 'lesson-2'], Number.NaN, { schema: 1, lessons: {} }, manifest).label, '0 / 2 課');
  });

  it('側邊欄一課都沒有：0 / 0 課、0%，不會除以零', () => {
    assert.deepEqual(summarize([], 0, { schema: 1, lessons: {} }, manifest), { doneIds: [], label: '0 / 0 課', percent: 0 });
  });
});

describe('課程清單的格式檢查（parseManifest）', () => {
  it('正常的清單原樣讀進來', () => {
    assert.deepEqual(parseManifest(JSON.stringify(manifest)), manifest);
  });

  it('讀不出來或不是物件：空的，不丟例外', () => {
    for (const bad of [undefined, null, '', '{壞掉', '123', '[]', 'null', '"x"']) {
      assert.deepEqual(parseManifest(bad), {}, String(bad));
    }
  });

  it('壞掉的那一課丟掉，其他課照舊', () => {
    const json = JSON.stringify({
      'lesson-1': { exercises: ['lesson-1/ex-1'], questions: ['q1'] },
      'lesson-2': { exercises: 'oops', questions: [] },
      'lesson-3': { exercises: [1], questions: [] },
      'lesson-4': null,
      'lesson-5': { exercises: [] },
    });
    assert.deepEqual(parseManifest(json), { 'lesson-1': { exercises: ['lesson-1/ex-1'], questions: ['q1'] } });
  });
});

describe('剛完成的課（newlyDone，D-025 的 ✓ 彈一下和彩帶）', () => {
  it('打開頁面時第一次畫：已經完成的課不算剛完成', () => {
    assert.deepEqual(newlyDone(null, ['lesson-1']), []);
  });

  it('這一次才完成的課才算', () => {
    assert.deepEqual(newlyDone([], ['lesson-1']), ['lesson-1']);
    assert.deepEqual(newlyDone(['lesson-1'], ['lesson-1', 'lesson-3']), ['lesson-3']);
  });

  it('沒有變、或進度被清掉（變成沒完成）：都不算', () => {
    assert.deepEqual(newlyDone(['lesson-1'], ['lesson-1']), []);
    assert.deepEqual(newlyDone(['lesson-1'], []), []);
  });
});
