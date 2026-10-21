// 側邊欄上方「學習進度」的更新程式（docs/CONTRACT.md B7；版面和接口見 src/components/layout/README.md）。
// 側邊欄在每一頁都有，所以 src/components/layout/Sidebar.astro 放了 <SidebarProgress /> 來載入這支程式；
// 它會同時把「每一課要做完哪些練習、測驗有哪幾題」寫進頁面（#vl-lesson-manifest），這裡才算得出哪幾課完成了。
import { getProgress, isLessonDone, type LessonSpec, type ProgressState } from '../../lib/progress-store.ts'; // 要 Node 直接測這個檔案，所以寫出副檔名（tsconfig 允許）

export type Manifest = Record<string, LessonSpec>;

export interface SidebarSummary {
  doneIds: string[]; // 完成的課
  label: string; // 例如「1 / 3 課」
  percent: number; // 0～100，進度條的寬度
}

// '/Gm-use/lessons/lesson-1/' → 'lesson-1'；不是課程頁的網址傳回 null
export function lessonIdFromPath(pathname: string): string | null {
  return /\/lessons\/(lesson-[1-9]\d*)\/?$/.exec(pathname)?.[1] ?? null;
}

// lessonIds：側邊欄裡出現的課；total：總課數（Sidebar.astro 放在 data-vl-total，算不出來就用 lessonIds 的數量）
export function summarize(lessonIds: string[], total: number, state: ProgressState, manifest: Manifest): SidebarSummary {
  const count = total > 0 ? total : lessonIds.length;
  const doneIds = lessonIds.filter((id) => manifest[id] !== undefined && isLessonDone(state, id, manifest[id]));
  return { doneIds, label: `${doneIds.length} / ${count} 課`, percent: count > 0 ? Math.round((doneIds.length / count) * 100) : 0 };
}

// 清單是建置時寫進頁面的，但還是檢查一次格式：壞掉的那一課當作沒有
export function parseManifest(json: string | null | undefined): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json ?? '{}');
  } catch {
    return {};
  }
  const manifest: Manifest = {};
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return manifest;
  for (const [id, spec] of Object.entries(parsed)) {
    const { exercises, questions } = (spec ?? {}) as Record<string, unknown>;
    const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
    if (strings(exercises) && strings(questions)) manifest[id] = { exercises, questions };
  }
  return manifest;
}

function render(state: ProgressState, manifest: Manifest): void {
  const boxes = document.querySelectorAll<HTMLElement>('[data-vl-progress]');
  if (boxes.length === 0) return;

  const links = [...document.querySelectorAll<HTMLAnchorElement>('nav.sidebar a[href]')]
    .map((link) => ({ link, id: lessonIdFromPath(new URL(link.href, location.href).pathname) }))
    .filter((entry): entry is { link: HTMLAnchorElement; id: string } => entry.id !== null);
  const lessonIds = [...new Set(links.map((entry) => entry.id))];

  for (const box of boxes) {
    const summary = summarize(lessonIds, Number(box.dataset.vlTotal), state, manifest);
    const count = box.querySelector('[data-vl-progress-count]');
    if (count) count.textContent = summary.label;
    const fill = box.querySelector<HTMLElement>('[data-vl-progress-fill]');
    if (fill) fill.style.width = `${summary.percent}%`;
    // 完成的課程連結加 data-vl-done="true"（CSS 會在後面加 ✓）；沒完成的拿掉，進度被清掉時 ✓ 才會跟著消失
    for (const { link, id } of links) {
      if (summary.doneIds.includes(id)) link.dataset.vlDone = 'true';
      else delete link.dataset.vlDone;
    }
  }
}

function start(): void {
  const manifest = parseManifest(document.getElementById('vl-lesson-manifest')?.textContent);
  render(getProgress(), manifest);
  // 進度有改動時（這個分頁的練習、測驗，或別的分頁）：用事件帶來的最新進度重畫，
  // 不從這個模組自己的快取讀，這樣就算練習那邊用的是另一份模組實體，也不會讀到舊的。
  window.addEventListener('vibe:progress', (event) => render((event as CustomEvent<ProgressState>).detail, manifest));
}

if (typeof document !== 'undefined') start();
