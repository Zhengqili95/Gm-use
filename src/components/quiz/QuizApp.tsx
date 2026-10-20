import { useEffect, useState } from 'preact/hooks';
import { getProgress, lessonIdOf, readQuizAnswers, subscribe, updateQuiz, type QuizAnswer } from '../../lib/progress-store';
import type { Quiz } from '../../lib/schemas';
import { applyPick, scoreOf, shuffledOrder } from './quiz-logic';

type Question = Quiz['questions'][number];

export default function QuizApp({ quiz }: { quiz: Quiz }) {
  const lessonId = lessonIdOf(quiz.id);
  // 伺服器端渲染出來的內容沒有選項，也還沒讀進度：等水合完成之後才打亂、才讀進度，
  // 這樣第一次畫出來的樣子和伺服器端一樣；而且伺服器端的網頁裡不會有按檔案順序排好的選項。
  const [orders, setOrders] = useState<number[][] | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setOrders(quiz.questions.map((question) => shuffledOrder(question.options.length)));
    setAnswers(readQuizAnswers(getProgress(), lessonId));
    // 進度的唯一來源是儲存的進度：這個分頁或別的分頁改了，畫面都跟著變
    return subscribe((state) => setAnswers(readQuizAnswers(state, lessonId)));
  }, []);

  function pick(question: Question, original: number) {
    const option = question.options[original];
    if (!option) return;
    // 從儲存的進度讀最新的，不用畫面上的 answers：連點兩下時，畫面還來不及更新
    const next = applyPick(readQuizAnswers(getProgress(), lessonId)[question.id], option, original);
    // 點的是已經點過的選項：說明本來就在畫面上，不用再存
    if (next) updateQuiz(lessonId, question.id, next);
    setAnnouncement(`${option.correct ? '正確。' : '不是這個答案。'}${option.explain}`);
  }

  const score = scoreOf(quiz.questions, answers);

  return (
    <section class="vl-quiz not-content" data-quiz-id={quiz.id}>
      <ol class="vl-quiz-list">
        {quiz.questions.map((question, index) => {
          const answer = answers[question.id];
          // 進度裡記的是選項在檔案裡的位置；題目改過、位置超出範圍的就不理它
          const picked = (answer?.picked ?? []).filter((original) => original < question.options.length);
          const order = orders?.[index];
          const promptId = `${quiz.id}-${question.id}-prompt`;
          return (
            <li key={question.id} class="vl-quiz-question" data-question-id={question.id} data-done={answer?.done ? 'true' : 'false'}>
              <p class="vl-quiz-prompt" id={promptId}>
                <span class="vl-quiz-number">第 {index + 1} 題</span>
                {question.prompt}
              </p>
              {question.code && (
                <pre class="vl-quiz-code">
                  <code>{question.code}</code>
                </pre>
              )}
              {order ? (
                <ul class="vl-quiz-options" aria-labelledby={promptId}>
                  {order.map((original) => {
                    const option = question.options[original]!;
                    const tried = picked.includes(original);
                    const state = tried ? (option.correct ? 'correct' : 'wrong') : 'idle';
                    return (
                      <li key={original}>
                        <button type="button" class="vl-quiz-option" data-state={state} data-option-index={original} onClick={() => pick(question, original)}>
                          <span class="vl-quiz-mark" aria-hidden="true">
                            {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : ''}
                          </span>
                          <span class="vl-quiz-option-text">{option.text}</span>
                          {tried && <span class="sr-only">{option.correct ? '（正確答案）' : '（不是正確答案）'}</span>}
                        </button>
                        {tried && (
                          <p class="vl-quiz-explain" data-kind={state} data-no-context>
                            {option.explain}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p class="vl-quiz-loading">選項載入中…</p>
              )}
            </li>
          );
        })}
      </ol>

      <div class="vl-quiz-summary" data-complete={score.complete ? 'true' : 'false'} data-no-context>
        <p class="vl-quiz-score">
          第一次就答對 <strong>{score.firstTry}</strong>／{score.total} 題
        </p>
        <p class="vl-quiz-status">{score.complete ? '✓ 測驗完成，每一題都答對了。' : `還有 ${score.total - score.done} 題還沒答對。`}</p>
      </div>

      {/* 給螢幕閱讀器的：點了選項之後，念出那個選項的說明 */}
      <p class="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
