// 測驗的計分和答題規則（docs/CONTRACT.md B6）。
// 只管資料，不碰畫面，所以可以直接用 Node 測。
import type { QuizAnswer } from '../../lib/progress-store';

export interface QuizOption {
  text: string;
  correct?: boolean;
  explain: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  code?: string;
  options: QuizOption[];
}

// 0 到 length - 1 隨機排一次（Fisher–Yates）。畫面用它決定選項怎麼排；
// 進度裡記的是選項在檔案裡的原始位置，所以怎麼排都不影響。random 可以換掉，測試才不用靠運氣。
export function shuffledOrder(length: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

// 學習者點了某個選項（original 是它在檔案裡的位置），這一題的紀錄會變成什麼樣子。
// 傳回 null 表示沒有變化：點的是已經點過的選項，只是再看一次說明。
// - 還沒答對時，每點一個新的選項算一次嘗試；點到正確的那個，這一題就完成。
// - 第一次嘗試就點對，才算「第一次就答對」（得分）。
// - 答對之後再點別的選項，只是看那個選項的說明：記下來（重新整理後還看得到），但不改計分。
export function applyPick(previous: QuizAnswer | undefined, option: QuizOption, original: number): QuizAnswer | null {
  const before: QuizAnswer = previous ?? { firstTryCorrect: false, tries: 0, done: false };
  const picked = before.picked ?? [];
  if (picked.includes(original)) return null;
  const next: QuizAnswer = { ...before, picked: [...picked, original] };
  if (!before.done) {
    next.tries = before.tries + 1;
    if (option.correct === true) {
      next.done = true;
      next.firstTryCorrect = before.tries === 0;
    }
  }
  return next;
}

export interface QuizScore {
  firstTry: number; // 第一次就答對的題數
  done: number; // 已經答對的題數
  total: number;
  complete: boolean; // 每一題最後都答對了
}

export function scoreOf(questions: ReadonlyArray<Pick<QuizQuestion, 'id'>>, answers: Record<string, QuizAnswer | undefined>): QuizScore {
  let firstTry = 0;
  let done = 0;
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer?.done !== true) continue;
    done++;
    if (answer.firstTryCorrect) firstTry++;
  }
  return { firstTry, done, total: questions.length, complete: questions.length > 0 && done === questions.length };
}
