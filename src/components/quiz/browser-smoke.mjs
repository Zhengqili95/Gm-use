// 選擇性的真瀏覽器驗收：測驗、練習、進度存檔、側邊欄「學習進度」（T-010）。不在 npm test 裡，因為要有執行中的網站和瀏覽器。
//
// 用法（先開網站：npm run dev，或 npm run build 之後 npm run preview）：
//   node src/components/quiz/browser-smoke.mjs <網站根網址，結尾有斜線> [課號，預設 1]
//   例如 node src/components/quiz/browser-smoke.mjs http://localhost:4321/Gm-use/
//
// 題目、選項、練習的標準答案都從 src/lessons/lesson-N/ 的 YAML 讀，所以課文內容改了不用改這支。
// 練習只支援 preview 類型；課文如果有 api、sql 練習，做不完整課，後面「一課完成」的步驟會略過。
// 瀏覽器：Windows 用內建的 Edge，其他系統用 Google Chrome；EXERCISE_TEST_BROWSER 可以改（和 test:exercises 一樣）。
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parse } from 'yaml';

const [root, lessonArg = '1'] = process.argv.slice(2);
if (!root) {
  console.error('用法：node src/components/quiz/browser-smoke.mjs <網站根網址，例如 http://localhost:4321/Gm-use/> [課號]');
  process.exit(2);
}
const base = root.replace(/\/?$/, '/');
const lessonId = `lesson-${Number(lessonArg)}`;
const lessonUrl = `${base}lessons/${lessonId}/`;
const dataDir = fileURLToPath(new URL(`../../lessons/${lessonId}/`, import.meta.url));
const STORAGE_KEY = 'vibe-learn:progress';

const quiz = parse(await readFile(`${dataDir}quiz.yaml`, 'utf8'));
const exercises = [];
for (const name of (await readdir(dataDir)).filter((file) => /^ex-\d+\.yaml$/.test(file)).sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10))) {
  exercises.push(parse(await readFile(`${dataDir}${name}`, 'utf8')));
}
const correctOf = (question) => question.options.findIndex((option) => option.correct === true);
const wrongOf = (question) => question.options.findIndex((option) => option.correct !== true);
const total = quiz.questions.length;

let passed = 0;
let failed = 0;
function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `（${detail}）` : ''}`);
  }
}

const browser = await chromium.launch({ channel: process.env.EXERCISE_TEST_BROWSER || (process.platform === 'win32' ? 'msedge' : 'chrome') });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const question = (id) => page.locator(`.vl-quiz-question[data-question-id="${id}"]`);
  const option = (id, index) => question(id).locator(`.vl-quiz-option[data-option-index="${index}"]`);
  const score = async () => (await page.locator('.vl-quiz-score').innerText()).replace(/\s+/g, '');
  const status = () => page.locator('.vl-quiz-status').innerText();
  const count = () => page.locator('[data-vl-progress-count]').first().innerText();
  const barWidth = () => page.locator('[data-vl-progress-fill]').first().evaluate((el) => el.style.width);
  const doneLessons = () =>
    page.locator('nav.sidebar a[data-vl-done="true"]').evaluateAll((links) => links.map((link) => new URL(link.href).pathname.replace(/\/$/, '').split('/').pop()));
  const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
  const savedAnswer = async (id) => (await saved())?.lessons?.[lessonId]?.quiz?.answers?.[id];

  // 測驗是 client:visible，捲到才水合；伺服器端的畫面沒有選項，所以等第一個選項出現就是水合完成了
  async function open() {
    await page.goto(lessonUrl, { waitUntil: 'networkidle' });
    await page.locator('.vl-quiz').scrollIntoViewIfNeeded();
    await page.locator('.vl-quiz-option').first().waitFor({ timeout: 15000 });
  }

  console.log(`\n[1] 第一次打開 ${lessonUrl}：沒有進度`);
  await page.goto(lessonUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await open();
  const totalLessons = Number((await count()).match(/\/ (\d+) 課$/)?.[1]);
  ok('側邊欄是「0 / N 課」，進度條 0%', (await count()) === `0 / ${totalLessons} 課` && (await barWidth()) === '0%', await count());
  ok('沒有完成的課', (await doneLessons()).length === 0);
  ok(`題目數和 YAML 一樣（${total} 題）`, (await page.locator('.vl-quiz-question').count()) === total);
  ok('每題的選項數和 YAML 一樣', (await page.locator('.vl-quiz-question').evaluateAll((items) => items.map((item) => item.querySelectorAll('.vl-quiz-option').length))).join() === quiz.questions.map((q) => q.options.length).join());
  ok('一開始沒有說明、沒有選項被標成對或錯', (await page.locator('.vl-quiz-explain, .vl-quiz-option[data-state="correct"], .vl-quiz-option[data-state="wrong"]').count()) === 0);
  ok(`分數是「第一次就答對 0／${total} 題」，還有 ${total} 題沒答對`, (await score()) === `第一次就答對0／${total}題` && (await status()).includes(`還有 ${total} 題`), await score());

  console.log('\n[2] 選項順序每次載入都會打亂');
  const first = quiz.questions[0];
  const firsts = new Set();
  for (let i = 0; i < 12; i++) {
    await open();
    firsts.add(await question(first.id).locator('.vl-quiz-option').first().getAttribute('data-option-index'));
  }
  ok('重新載入 12 次，第 1 題最前面的選項不會永遠一樣', firsts.size >= 2, [...firsts].join(','));

  console.log('\n[3] 第 1 題：先點錯、再點對');
  await open();
  const [wrong1, right1] = [wrongOf(first), correctOf(first)];
  await option(first.id, wrong1).click();
  ok('點錯：選項標成 wrong、有 ✗，下面出現那個選項的說明', (await option(first.id, wrong1).getAttribute('data-state')) === 'wrong' && (await option(first.id, wrong1).innerText()).includes('✗') && (await option(first.id, wrong1).locator('xpath=..').locator('.vl-quiz-explain').innerText()) === first.options[wrong1].explain);
  ok('點錯：題目還沒完成，可以再選，分數是 0', (await question(first.id).getAttribute('data-done')) === 'false' && (await option(first.id, right1).isEnabled()) && (await score()) === `第一次就答對0／${total}題`);
  await option(first.id, right1).click();
  ok('點對：選項標成 correct、有 ✓，題目完成，兩個說明都在', (await option(first.id, right1).getAttribute('data-state')) === 'correct' && (await option(first.id, right1).innerText()).includes('✓') && (await question(first.id).getAttribute('data-done')) === 'true' && (await question(first.id).locator('.vl-quiz-explain').count()) === 2);
  ok('先錯後對：不算第一次就答對（分數還是 0）', (await score()) === `第一次就答對0／${total}題`, await score());
  ok('進度存下來了：picked 是原始位置、tries 2、done true', JSON.stringify(await savedAnswer(first.id)) === JSON.stringify({ firstTryCorrect: false, tries: 2, done: true, picked: [wrong1, right1] }), JSON.stringify(await savedAnswer(first.id)));

  console.log('\n[4] 第 2 題：第一次就點對，得 1 分；答對之後再點別的選項只是看說明');
  const second = quiz.questions[1];
  await option(second.id, correctOf(second)).click();
  ok('第一次就答對 1 題', (await score()) === `第一次就答對1／${total}題`, await score());
  await option(second.id, wrongOf(second)).click();
  ok('答對後再點別的選項：看得到說明、分數沒變、tries 還是 1', (await question(second.id).locator('.vl-quiz-explain').count()) === 2 && (await score()) === `第一次就答對1／${total}題` && (await savedAnswer(second.id)).tries === 1);
  await option(second.id, correctOf(second)).click();
  ok('再點已經點過的選項：不會多存一筆', (await savedAnswer(second.id)).picked.length === 2);

  console.log('\n[5] 重新整理：進度還在，選項重新打亂之後對錯標記也對得上');
  await open();
  ok('第 1 題完成，原始位置上的對錯標記沒變', (await question(first.id).getAttribute('data-done')) === 'true' && (await option(first.id, wrong1).getAttribute('data-state')) === 'wrong' && (await option(first.id, right1).getAttribute('data-state')) === 'correct');
  ok('第 2 題完成，說明還在；分數還是 1', (await question(second.id).locator('.vl-quiz-explain').count()) === 2 && (await score()) === `第一次就答對1／${total}題`);

  console.log('\n[6] 答完其他題目（第 3 題先錯後對，其餘一次對）');
  for (const [index, other] of quiz.questions.slice(2).entries()) {
    if (index === 0 && other.options.length > 1) await option(other.id, wrongOf(other)).click();
    await option(other.id, correctOf(other)).click();
  }
  const firstTry = total - 2; // 第 1、3 題先錯後對，不算（測驗至少 3 題，schema 保證）
  ok(`測驗完成，第一次就答對 ${firstTry}／${total} 題`, (await score()) === `第一次就答對${firstTry}／${total}題` && (await status()).includes('測驗完成') && (await page.locator('.vl-quiz-summary').getAttribute('data-complete')) === 'true', `${await score()} ${await status()}`);
  ok('測驗做完了，練習還沒做：側邊欄還是 0 課', (await count()).startsWith('0 /'), await count());

  console.log('\n[7] 做練習：把標準答案打進編輯區再按「檢查」，最後一個過關之後，這一課才算完成');
  const unsupported = exercises.filter((exercise) => exercise.type !== 'preview');
  if (unsupported.length > 0) {
    console.log(`  － 略過：有 ${unsupported.length} 個 ${[...new Set(unsupported.map((e) => e.type))].join('、')} 練習，這支腳本還不會做`);
  } else {
    for (const [index, exercise] of exercises.entries()) {
      const box = page.locator(`.vl-ex[data-exercise-id="${exercise.id}"]`);
      await box.scrollIntoViewIfNeeded();
      // 伺服器端的畫面就有 textarea；要等元件水合完成（astro-island 拿掉 ssr 屬性）才能操作
      await page.locator(`astro-island:not([ssr]) .vl-ex[data-exercise-id="${exercise.id}"]`).waitFor({ timeout: 20000 });
      for (const name of exercise.editable) {
        if (exercise.editable.length > 1) await box.locator('.vl-ex-tab', { hasText: name }).click();
        await box.locator('textarea').fill(exercise.solution[name] ?? exercise.files[name]);
      }
      await box.locator('[data-action="check"]').click();
      await page.waitForFunction((id) => document.querySelector(`.vl-ex[data-exercise-id="${id}"]`)?.getAttribute('data-status') === 'passed', exercise.id, { timeout: 20000 }).catch(() => {});
      ok(`${exercise.id} 過關`, (await box.getAttribute('data-status')) === 'passed', await box.getAttribute('data-status'));
      if (index < exercises.length - 1) ok('還有練習沒做完：側邊欄還是 0 課', (await count()).startsWith('0 /'), await count());
    }
    await page.waitForTimeout(300);
    ok(`練習和測驗都做完：側邊欄是「1 / ${totalLessons} 課」，進度條 ${Math.round(100 / totalLessons)}%，這一課的連結有 ✓`, (await count()) === `1 / ${totalLessons} 課` && (await barWidth()) === `${Math.round(100 / totalLessons)}%` && (await doneLessons()).join() === lessonId, `${await count()} ${await barWidth()} ${(await doneLessons()).join()}`);
    ok('連結後面的 ✓ 真的畫出來了', (await page.locator('nav.sidebar a[data-vl-done="true"]').evaluate((el) => getComputedStyle(el, '::after').content)).includes('✓'));

    console.log('\n[8] 重新整理、換頁：側邊欄一載入就是完成的；側邊欄裡的每個課程頁都一樣');
    const hrefs = await page.locator('nav.sidebar a[href*="/lessons/lesson-"]').evaluateAll((links) => [...new Set(links.map((link) => link.href))]);
    for (const href of hrefs) {
      await page.goto(href, { waitUntil: 'networkidle' });
      ok(`${new URL(href).pathname}：1 / ${totalLessons} 課，只有 ${lessonId} 打勾`, (await count()) === `1 / ${totalLessons} 課` && (await doneLessons()).join() === lessonId, `${await count()} ${(await doneLessons()).join()}`);
    }

    console.log('\n[9] 另一個分頁清掉進度：這個分頁的側邊欄跟著變回 0');
    await page.goto(lessonUrl, { waitUntil: 'networkidle' });
    const other = await context.newPage();
    await other.goto(lessonUrl, { waitUntil: 'networkidle' });
    await other.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.waitForFunction(() => document.querySelector('[data-vl-progress-count]')?.textContent?.startsWith('0 /'), null, { timeout: 5000 }).catch(() => {});
    ok('進度被清掉：側邊欄回到 0、✓ 消失', (await count()).startsWith('0 /') && (await doneLessons()).length === 0, await count());
    await other.close();
  }

  console.log('\n[10] 手機寬度：頁面不會橫向捲動（測驗裡有一行很長的程式碼，曾經把版面撐寬）');
  for (const width of [320, 375]) {
    const narrow = await browser.newContext({ viewport: { width, height: 800 } });
    const mobile = await narrow.newPage();
    await mobile.goto(lessonUrl, { waitUntil: 'networkidle' });
    await mobile.locator('.vl-quiz').scrollIntoViewIfNeeded();
    await mobile.locator('.vl-quiz-option').first().waitFor({ timeout: 15000 });
    const sizes = await mobile.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    ok(`寬度 ${width}：scrollWidth ${sizes.scroll}、clientWidth ${sizes.client}`, sizes.scroll <= sizes.client);
    await narrow.close();
  }

  console.log('\n[11] 直接把進度寫進 localStorage 的幾種情況：側邊欄怎麼判斷');
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const questionIds = quiz.questions.map((item) => item.id);
  const progress = (statuses, quizDone = true) => ({
    schema: 1,
    lessons: {
      [lessonId]: {
        exercises: Object.fromEntries(exerciseIds.map((id, index) => [id, { status: statuses[index], attempts: 1, failedAttempts: 0, hintsShown: 0, revealShown: statuses[index] === 'revealed', files: {}, updatedAt: '' }])),
        quiz: { answers: Object.fromEntries(questionIds.map((id) => [id, { firstTryCorrect: true, tries: 1, done: quizDone, picked: [0] }])) },
      },
    },
  });
  const countWith = async (value) => {
    await page.goto(lessonUrl, { waitUntil: 'networkidle' });
    await page.evaluate(([key, text]) => localStorage.setItem(key, text), [STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value)]);
    await page.goto(lessonUrl, { waitUntil: 'networkidle' });
    return count();
  };
  const all = (status) => exerciseIds.map(() => status);
  ok('練習都過、測驗都答對：完成', (await countWith(progress(all('passed')))) === `1 / ${totalLessons} 課`);
  ok('有一個練習是看過答案之後過關（revealed）：也算完成', (await countWith(progress(exerciseIds.map((_, index) => (index === 0 ? 'revealed' : 'passed'))))) === `1 / ${totalLessons} 課`);
  ok('有一個練習只試過（attempted）：不算完成', (await countWith(progress(exerciseIds.map((_, index) => (index === 0 ? 'attempted' : 'passed'))))) === `0 / ${totalLessons} 課`);
  ok('練習都過了，但測驗還沒答對：不算完成', (await countWith(progress(all('passed'), false))) === `0 / ${totalLessons} 課`);
  for (const bad of ['{壞掉', '{"schema":1,"lessons":{"' + lessonId + '":{"exercises":5,"quiz":{"answers":"x"}}}}', '{"schema":1,"lessons":{"' + lessonId + '":{"exercises":{"x":null},"quiz":{"answers":{"q1":null}}}}}']) {
    ok(`進度資料被改壞（${bad.slice(0, 20)}…）：當作沒有進度，不出錯`, (await countWith(bad)) === `0 / ${totalLessons} 課`);
  }
  {
    const phone = await browser.newContext({ viewport: { width: 375, height: 800 } });
    await phone.addInitScript(([key, text]) => localStorage.setItem(key, text), [STORAGE_KEY, JSON.stringify(progress(all('passed')))]);
    const mobile = await phone.newPage();
    await mobile.goto(lessonUrl, { waitUntil: 'networkidle' });
    await mobile.locator('button.sl-menu-button').click();
    await mobile.locator('[data-vl-progress]').first().waitFor({ state: 'visible' });
    ok('手機寬度打開選單：看得到「學習進度」，數字是完成', (await mobile.locator('[data-vl-progress-count]').first().innerText()) === `1 / ${totalLessons} 課`);
    await phone.close();
  }

  ok('整個過程沒有 console error 或未處理的例外', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${passed} 項通過，${failed} 項沒過`);
process.exit(failed > 0 ? 1 : 0);
