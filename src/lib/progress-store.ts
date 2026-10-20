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

export interface QuizProgress {
  answers: Record<string, { firstTryCorrect: boolean; tries: number; done: boolean }>;
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

export function updateQuiz(
  lessonId: string,
  questionId: string,
  patch: Partial<QuizProgress['answers'][string]>,
): void {
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
