// 學習進度的儲存（docs/CONTRACT.md B7）：存在瀏覽器的 localStorage，所有 island 共用同一份。
// 讀寫都包 try/catch：無痕模式等情況用不了 localStorage 時，退回只存在記憶體，不丟例外。

export type ExerciseStatus = 'todo' | 'attempted' | 'passed' | 'revealed';

export interface ExerciseProgress {
  status: ExerciseStatus;
  attempts: number; // 按「檢查」的總次數
  failedAttempts: number; // 其中沒通過的次數
  hintsShown: 0 | 1 | 2 | 3;
  revealShown: boolean; // 看過標準答案
  files: Record<string, string>; // 學習者目前改過的程式碼（只存可編輯的檔案）
  lastFailedCheck?: { id: string; hint: string };
  updatedAt: string; // ISO 時間
}

export interface QuizAnswer {
  firstTryCorrect: boolean; // 第一次點就點對（只有這種才得分）
  tries: number; // 答對之前點過幾個不同的選項（含答對的那一次）
  done: boolean; // 這一題已經答對
  picked?: number[]; // 點過的選項，依先後，用「選項在檔案裡的原始位置」記錄（B6），所以選項怎麼打亂都對得上
}

export interface QuizProgress {
  answers: Record<string, QuizAnswer>;
}

// 一課要做完的東西：課文 frontmatter 的 exercises，加上測驗裡每一題的 id
export interface LessonSpec {
  exercises: string[];
  questions: string[];
}

export interface LessonProgress {
  exercises: Record<string, ExerciseProgress>;
  quiz?: QuizProgress;
}

export interface ProgressState {
  schema: 1; // 這份儲存格式自己的版本
  lessons: Record<string, LessonProgress>;
}

export const STORAGE_KEY = 'vibe-learn:progress';

export function emptyState(): ProgressState {
  return { schema: 1, lessons: {} };
}

export function emptyExercise(): ExerciseProgress {
  return { status: 'todo', attempts: 0, failedAttempts: 0, hintsShown: 0, revealShown: false, files: {}, updatedAt: '' };
}

// 'lesson-1/ex-1' → 'lesson-1'
export function lessonIdOf(exerciseId: string): string {
  return exerciseId.split('/')[0] ?? exerciseId;
}

function isState(value: unknown): value is ProgressState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schema?: unknown; lessons?: unknown };
  return candidate.schema === 1 && typeof candidate.lessons === 'object' && candidate.lessons !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// localStorage 的內容可能被改壞或舊版留下的：每一課至少要有 exercises 物件、quiz 要有 answers 物件，
// 壞掉的那一塊直接丟掉（當作還沒有進度），不要讓後面的 updateExercise、updateQuiz 出錯。
function normalize(state: ProgressState): ProgressState {
  const lessons: Record<string, LessonProgress> = {};
  for (const [id, lesson] of Object.entries(state.lessons as Record<string, unknown>)) {
    if (!isRecord(lesson)) continue;
    const next: LessonProgress = { exercises: isRecord(lesson.exercises) ? (lesson.exercises as Record<string, ExerciseProgress>) : {} };
    if (isRecord(lesson.quiz) && isRecord(lesson.quiz.answers)) next.quiz = { answers: lesson.quiz.answers as QuizProgress['answers'] };
    lessons[id] = next;
  }
  return { schema: 1, lessons };
}

let cache: ProgressState | null = null;
const listeners = new Set<(state: ProgressState) => void>();

function load(): ProgressState {
  if (cache) return cache;
  let parsed: unknown = null;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // 讀不到或內容壞掉：當作還沒有進度
  }
  cache = isState(parsed) ? normalize(parsed) : emptyState();
  return cache;
}

function notify(state: ProgressState): void {
  for (const listener of listeners) listener(state);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vibe:progress', { detail: state }));
}

function save(state: ProgressState): void {
  cache = state;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 寫不進去（容量滿、無痕模式）：這次只留在記憶體
  }
  notify(state);
}

export function getProgress(): ProgressState {
  return load();
}

export function getExercise(exerciseId: string): ExerciseProgress | undefined {
  // localStorage 的內容可能被改壞（少了 exercises 之類），所以每一層都用 ?.
  return load().lessons[lessonIdOf(exerciseId)]?.exercises?.[exerciseId];
}

export function updateExercise(exerciseId: string, patch: Partial<ExerciseProgress>): ExerciseProgress {
  const state = load();
  const lessonId = lessonIdOf(exerciseId);
  const lesson = state.lessons[lessonId] ?? { exercises: {} };
  const next: ExerciseProgress = {
    ...(lesson.exercises[exerciseId] ?? emptyExercise()),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (patch.lastFailedCheck === undefined && 'lastFailedCheck' in patch) delete next.lastFailedCheck;
  save({ ...state, lessons: { ...state.lessons, [lessonId]: { ...lesson, exercises: { ...lesson.exercises, [exerciseId]: next } } } });
  return next;
}

export function updateQuiz(lessonId: string, questionId: string, patch: Partial<QuizAnswer>): void {
  const state = load();
  const lesson = state.lessons[lessonId] ?? { exercises: {} };
  const quiz = lesson.quiz ?? { answers: {} };
  const previous = quiz.answers[questionId] ?? { firstTryCorrect: false, tries: 0, done: false };
  save({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: { ...lesson, quiz: { answers: { ...quiz.answers, [questionId]: { ...previous, ...patch } } } },
    },
  });
}

// 讀某一課測驗的答題紀錄。localStorage 的內容可能被改壞，所以每一筆都檢查過才交出去：
// 格式不對的整筆丟掉，picked 只留非負整數（而且不重複）。
export function readQuizAnswers(state: ProgressState, lessonId: string): Record<string, QuizAnswer> {
  const raw = state.lessons[lessonId]?.quiz?.answers;
  const answers: Record<string, QuizAnswer> = {};
  if (!isRecord(raw)) return answers;
  for (const [questionId, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) continue;
    const answer: QuizAnswer = {
      firstTryCorrect: entry.firstTryCorrect === true,
      tries: typeof entry.tries === 'number' && Number.isInteger(entry.tries) && entry.tries >= 0 ? entry.tries : 0,
      done: entry.done === true,
    };
    if (Array.isArray(entry.picked)) {
      answer.picked = [...new Set(entry.picked.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0))];
    }
    answers[questionId] = answer;
  }
  return answers;
}

// ---------- 「一課完成」的判斷（B7） ----------

// 練習算完成：過關（passed），或看過答案之後過關（revealed）
export function isExerciseDone(progress: ExerciseProgress | undefined): boolean {
  return progress?.status === 'passed' || progress?.status === 'revealed';
}

// 一課完成：課文 frontmatter 的 exercises 裡每個練習都完成，而且測驗每一題都答對（done）。
// 沒有練習或沒有測驗題目的課（還沒做好的佔位頁）不算完成，不然「每一個都完成」會在空的清單上成立。
export function isLessonDone(state: ProgressState, lessonId: string, spec: LessonSpec): boolean {
  if (spec.exercises.length === 0 || spec.questions.length === 0) return false;
  const lesson = state.lessons[lessonId];
  const answers = readQuizAnswers(state, lessonId);
  return (
    spec.exercises.every((id) => isExerciseDone(lesson?.exercises?.[id])) &&
    spec.questions.every((id) => answers[id]?.done === true)
  );
}

// 進度有改動時通知；回傳取消訂閱的函式
export function subscribe(listener: (state: ProgressState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reset(): void {
  save(emptyState());
}

// 另一個分頁改了進度：丟掉快取，重讀，再通知
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    notify(load());
  });
}

// 給測試用：清掉記憶體裡的快取
export function __resetCacheForTests(): void {
  cache = null;
  listeners.clear();
}
