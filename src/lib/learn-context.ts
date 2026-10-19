// 給「問 AI」用的上下文（docs/CONTRACT.md B8）：目前這一頁的課文，加上每個練習的即時狀態。
// 練習元件載入之後會把自己登記進來，所以學習者剛打的字也看得到，不用等存檔。
import { getProgress, subscribe, type ExerciseStatus, type ProgressState } from './progress-store';

export interface ContextExercise {
  id: string;
  type: 'preview' | 'api' | 'sql';
  goal: string;
  status: ExerciseStatus;
  hintsShown: 0 | 1 | 2 | 3;
  files: Record<string, string>; // 學習者目前的程式碼（含唯讀的檔案，AI 才看得懂整個頁面）
  lastFailedCheck?: { id: string; hint: string };
}

export interface LessonContext {
  lessonId: string;
  title: string;
  text: string; // 課文的純文字（不含練習區、標準答案）
  activeExerciseId?: string; // 學習者最後操作的練習
  exercises: ContextExercise[];
}

export interface VibeLearnApi {
  version: 1;
  getContext(): LessonContext;
  getProgress(): ProgressState;
  subscribe(listener: (state: ProgressState) => void): () => void;
}

declare global {
  interface Window {
    vibeLearn?: VibeLearnApi;
  }
}

type Snapshot = Pick<ContextExercise, 'status' | 'hintsShown' | 'files' | 'lastFailedCheck'>;
interface Registered {
  type: ContextExercise['type'];
  goal: string;
  snapshot: () => Snapshot;
}

const registry = new Map<string, Registered>();
let activeExerciseId: string | undefined;

// 練習元件載入時登記；回傳取消登記的函式
export function registerExercise(
  id: string,
  meta: { type: ContextExercise['type']; goal: string },
  snapshot: () => Snapshot,
): () => void {
  registry.set(id, { ...meta, snapshot });
  return () => {
    registry.delete(id);
  };
}

// 學習者操作了某個練習（編輯、檢查、看提示…）
export function touchExercise(id: string): void {
  activeExerciseId = id;
}

// 這些元素的文字當成「換行」：段落、標題、清單、程式碼區塊…
const BLOCK = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'PRE', 'BLOCKQUOTE', 'TR', 'DIV', 'SECTION',
  'ARTICLE', 'ASIDE', 'DETAILS', 'SUMMARY', 'TABLE', 'FIGURE', 'FIGCAPTION', 'BR', 'HR',
]);
const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'IFRAME', 'TEXTAREA', 'BUTTON', 'NOSCRIPT', 'TEMPLATE']);

function collect(node: Node, out: string[]): void {
  if (node.nodeType === 3) {
    out.push(node.textContent ?? '');
    return;
  }
  if (node.nodeType !== 1) return;
  const element = node as Element;
  if (SKIP.has(element.tagName.toUpperCase())) return;
  // data-no-context：標準答案、練習區這類不給 AI 看的內容；sr-only 和標題的錨點連結是給螢幕閱讀器的雜訊
  if (element.hasAttribute('data-no-context') || element.classList.contains('sr-only') || element.classList.contains('sl-anchor-link')) return;
  const block = BLOCK.has(element.tagName.toUpperCase());
  if (block) out.push('\n');
  for (const child of Array.from(element.childNodes)) collect(child, out);
  if (block) out.push('\n');
}

export function extractText(root: Element | null): string {
  if (!root) return '';
  const out: string[] = [];
  collect(root, out);
  return out
    .join('')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function currentLessonId(exerciseIds: string[]): string {
  const fromPath = /\/lessons\/(lesson-\d+)\/?/.exec(globalThis.location?.pathname ?? '');
  if (fromPath?.[1]) return fromPath[1];
  return exerciseIds[0]?.split('/')[0] ?? '';
}

export function getContext(): LessonContext {
  const ids = [...registry.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const heading = typeof document === 'undefined' ? null : document.querySelector('main h1');
  const content = typeof document === 'undefined' ? null : document.querySelector('.sl-markdown-content');
  const context: LessonContext = {
    lessonId: currentLessonId(ids),
    title: heading?.textContent?.trim() ?? (typeof document === 'undefined' ? '' : document.title),
    text: extractText(content),
    exercises: ids.map((id) => {
      const entry = registry.get(id)!;
      return { id, type: entry.type, goal: entry.goal, ...entry.snapshot() };
    }),
  };
  if (activeExerciseId && registry.has(activeExerciseId)) context.activeExerciseId = activeExerciseId;
  return context;
}

// 掛到 window.vibeLearn，讓不是模組的程式（外殼、問 AI）也能用
if (typeof window !== 'undefined') {
  window.vibeLearn = { version: 1, getContext, getProgress, subscribe };
}
