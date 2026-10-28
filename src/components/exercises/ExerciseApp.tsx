import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'preact/hooks';
import { registerExercise, touchExercise } from '../../lib/learn-context';
import { getExercise, updateExercise } from '../../lib/progress-store';
import { play } from '../fx/fx';
import { canReveal, initialFlow, isDone, reduce } from './flow';
import { buildSrcdoc } from './runner/build-srcdoc';
import { LOOP_ABORT_MARK } from './runner/guard-loops';
import iframeRunner from './runner/iframe-runner.js?raw';
import { runChecks } from './runner/run-checks';
import type { Files, PageExercise } from './types';

const HINT_LABELS = ['觀念提醒', '檢查位置', '語法範例'] as const;

// 預覽載入完成之後，頁面會回 ready；超過這麼久沒回，就是學習者的程式卡住了（一般的無窮迴圈會先被迴圈保護中止，B3）
const PREVIEW_READY_TIMEOUT_MS = 5000;
const PREVIEW_PING_INTERVAL_MS = 1000;

type Feedback = { kind: 'pass' | 'fail' | 'timeout'; text: string; remaining?: number } | null;
type FailedCheck = { id: string; hint: string } | undefined;

export default function ExerciseApp({ exercise }: { exercise: PageExercise }) {
  const startFiles = exercise.files as Files;
  const solution = exercise.solution as Files;
  const editable = exercise.editable as string[];
  const otherFiles = Object.keys(startFiles).filter((name) => !editable.includes(name) && startFiles[name] !== undefined);

  const [files, setFiles] = useState<Files>({ ...startFiles });
  const [activeFile, setActiveFile] = useState<string>(editable[0] ?? 'index.html');
  const [flow, dispatch] = useReducer(reduce, initialFlow);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [checking, setChecking] = useState(false);
  const [pageErrors, setPageErrors] = useState<string[]>([]);
  // version 當作 iframe 的 key：內容一變就換一個新的 iframe（見下面「預覽」那段）
  const [preview, setPreview] = useState(() => ({ doc: buildSrcdoc(startFiles, iframeRunner), version: 0 }));
  const [previewStuck, setPreviewStuck] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewReadyRef = useRef(false);
  // 互動回饋（D-025）要播動畫的地方
  const sectionRef = useRef<HTMLElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const hintsRef = useRef<HTMLOListElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);
  const hintAddedRef = useRef(false); // 按了「給我提示」才播；還原進度時多出來的提示不播

  // 最新的值放在 ref 裡，存檔和「問 AI」的上下文才讀得到即時的內容
  const filesRef = useRef(files);
  filesRef.current = files;
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const lastFailedRef = useRef<FailedCheck>(undefined);
  const restoredRef = useRef(false);
  const touchedRef = useRef(false); // 學習者碰過這個練習之後才存，沒碰過的不要在儲存空間留一筆空的

  function pickEditable(all: Files): Record<string, string> {
    return Object.fromEntries(editable.map((name) => [name, all[name] ?? '']));
  }

  function touch() {
    touchedRef.current = true;
    touchExercise(exercise.id);
  }

  function persist() {
    if (!touchedRef.current) return;
    const current = flowRef.current;
    updateExercise(exercise.id, {
      status: current.status,
      attempts: current.attempts,
      failedAttempts: current.failedAttempts,
      hintsShown: current.hintsShown,
      revealShown: current.revealShown,
      files: pickEditable(filesRef.current),
      lastFailedCheck: lastFailedRef.current,
    });
  }

  // 還原：等水合完成之後才做，避免和伺服器端渲染出來的內容對不起來
  useEffect(() => {
    const saved = getExercise(exercise.id);
    if (saved) {
      setFiles({ ...startFiles, ...saved.files });
      dispatch({
        type: 'restore',
        flow: {
          status: saved.status,
          attempts: saved.attempts,
          failedAttempts: saved.failedAttempts,
          hintsShown: saved.hintsShown,
          revealShown: saved.revealShown,
        },
      });
      lastFailedRef.current = saved.lastFailedCheck;
    }
    restoredRef.current = true;
  }, []);

  // 自動存檔：改程式或狀態變了，停 300 毫秒之後存
  useEffect(() => {
    if (!restoredRef.current) return;
    const timer = setTimeout(persist, 300);
    return () => clearTimeout(timer);
  }, [files, flow]);

  // 把自己登記給「問 AI」的上下文（getContext）
  useEffect(
    () =>
      registerExercise(exercise.id, { type: exercise.type, goal: exercise.goal }, () => ({
        status: flowRef.current.status,
        hintsShown: flowRef.current.hintsShown,
        files: Object.fromEntries(Object.entries(filesRef.current).filter((entry): entry is [string, string] => entry[1] !== undefined)),
        lastFailedCheck: lastFailedRef.current,
      })),
    [],
  );

  // 預覽：停止輸入 500 毫秒後才更新，避免每打一個字都重新載入。
  // 每次更新都換一個新的 iframe（key 不同），不在同一個 iframe 上換 srcdoc：舊的卡住時，換 srcdoc 的導覽會一直等下去。
  // 但這救不了所有情況：同一頁的沙箱 iframe 共用一個瀏覽器程序，程序卡住的話新的 iframe 也跑不動，
  // 而且從頁面拿掉卡住的 iframe 也停不了那個程序。所以真正的防線是迴圈保護（guard-loops.ts、B3），這裡的看門狗只是最後的提示。
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageErrors([]);
      setPreview((current) => {
        const doc = buildSrcdoc(files, iframeRunner);
        return doc === current.doc ? current : { doc, version: current.version + 1 };
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [files]);

  // 預覽的看門狗：每秒問預覽頁一次（ping），載入完成的頁面會回 ready。
  // 一直沒回，就顯示提示。伺服器端渲染的那個 iframe 在這個元件啟動之前就載入完了，錯過它自己送的 ready，所以不能只等它。
  useEffect(() => {
    setPreviewStuck(false);
    previewReadyRef.current = false;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (previewReadyRef.current) {
        clearInterval(timer);
        return;
      }
      previewRef.current?.contentWindow?.postMessage({ source: 'vibe', type: 'ping' }, '*');
      if (Date.now() - startedAt >= PREVIEW_READY_TIMEOUT_MS) {
        setPreviewStuck(true);
        clearInterval(timer);
      }
    }, PREVIEW_PING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [preview.version]);

  // 預覽頁送來的訊息：ready（載入完成）、error（程式出錯，顯示在預覽下面）
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== previewRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.source !== 'vibe') return;
      if (data.type === 'ready') {
        previewReadyRef.current = true;
        setPreviewStuck(false); // 慢慢跑完的迴圈之後恢復了，提示也跟著消失
      } else if (data.type === 'error') {
        setPageErrors((previous) => [...previous.slice(-2), String(data.message)]);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 互動回饋（D-025，src/components/fx/）：過關時整個練習框亮起來、結果彈出；沒過時結果晃一下。
  // 用 useLayoutEffect：畫面畫出來之前就開始播，不會先閃一下原本的樣子。減少動態時 play() 什麼都不做。
  useLayoutEffect(() => {
    if (!feedback) return;
    if (feedback.kind === 'pass') {
      play(sectionRef.current, 'glow');
      play(feedbackRef.current, 'pop');
    } else {
      play(feedbackRef.current, 'shake');
    }
  }, [feedback]);

  // 新的一層提示、打開的標準答案滑進來
  useLayoutEffect(() => {
    if (!hintAddedRef.current) return;
    hintAddedRef.current = false;
    play((hintsRef.current?.lastElementChild as HTMLElement | null) ?? null, 'slide-in');
  }, [flow.hintsShown]);

  useLayoutEffect(() => {
    if (solutionOpen) play(solutionRef.current, 'slide-in');
  }, [solutionOpen]);

  async function onCheck() {
    touch();
    persist(); // 執行前先存一次，萬一程式卡住，重新整理也不會丟程式碼
    setChecking(true);
    const outcome = await runChecks(files, exercise.checks);
    setChecking(false);
    const failed = exercise.checks.filter((check) => !outcome.passed.get(check.id));
    lastFailedRef.current = failed[0] ? { id: failed[0].id, hint: failed[0].hint } : undefined;
    // 逾時也算一次沒通過，不然學習者卡在無窮迴圈時，永遠等不到「看答案」
    dispatch({ type: 'check', passed: failed.length === 0 });
    if (outcome.timedOut) {
      // 只是不再等結果了：卡住的程式可能還在背景空轉，網頁沒辦法從裡面停掉它（迴圈保護攔不到的卡住，例如不是迴圈造成的）
      setFeedback({ kind: 'timeout', text: '程式執行太久，沒有等到結果；檢查一下程式有沒有卡住。如果頁面變慢，請重新整理。' });
    } else if (failed.length > 0 && outcome.errors.some((message) => message.includes(LOOP_ABORT_MARK))) {
      // 迴圈保護把一直跑不完的迴圈中止了
      setFeedback({ kind: 'timeout', text: '程式裡有迴圈一直跑不完，已經中止；檢查一下有沒有寫成永遠不會結束的迴圈（例如忘了讓條件變成 false）。' });
    } else if (failed.length === 0) {
      setFeedback({ kind: 'pass', text: exercise.success });
    } else {
      setFeedback({ kind: 'fail', text: failed[0]!.hint, remaining: failed.length });
    }
  }

  function onHint() {
    touch();
    hintAddedRef.current = true;
    dispatch({ type: 'hint' });
  }

  function onReveal() {
    touch();
    dispatch({ type: 'reveal' });
    setSolutionOpen(true);
  }

  function applySolution() {
    touch();
    setFiles((current) => ({ ...current, ...solution }));
    setSolutionOpen(false);
  }

  function onReset() {
    touch();
    setFiles({ ...startFiles });
    setFeedback(null);
  }

  const done = isDone(flow);

  return (
    <section ref={sectionRef} class="vl-ex" data-exercise-id={exercise.id} data-status={flow.status} data-no-context>
      <header class="vl-ex-head">
        <h3 class="vl-ex-title">{exercise.title}</h3>
        <span class="vl-ex-badge" data-done={done ? 'true' : 'false'}>
          {flow.status === 'revealed' ? '已完成（看過答案）' : done ? '已完成' : `約 ${exercise.minutes} 分鐘`}
        </span>
      </header>
      <p class="vl-ex-goal">{exercise.goal}</p>

      <div class="vl-ex-body">
        <div class="vl-ex-editor">
          {editable.length > 1 && (
            <div class="vl-ex-tabs" role="tablist">
              {editable.map((name) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={name === activeFile}
                  class="vl-ex-tab"
                  onClick={() => setActiveFile(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <label class="vl-ex-label" for={`${exercise.id}-${activeFile}`}>
            {activeFile}
          </label>
          <textarea
            id={`${exercise.id}-${activeFile}`}
            class="vl-ex-textarea"
            value={files[activeFile] ?? ''}
            rows={Math.max(6, (files[activeFile] ?? '').split('\n').length + 1)}
            spellcheck={false}
            autocapitalize="off"
            autocomplete="off"
            onInput={(event) => {
              touch();
              const value = event.currentTarget.value;
              setFiles((current) => ({ ...current, [activeFile]: value }));
            }}
          />
          {otherFiles.length > 0 && (
            <details class="vl-ex-others">
              <summary>其他檔案（唯讀）</summary>
              {otherFiles.map((name) => (
                <div>
                  <p class="vl-ex-label">{name}</p>
                  <pre class="vl-ex-pre">{startFiles[name]}</pre>
                </div>
              ))}
            </details>
          )}
        </div>

        <div class="vl-ex-preview-box">
          <p class="vl-ex-label">預覽</p>
          <iframe
            key={preview.version}
            ref={previewRef}
            class="vl-ex-preview"
            title="預覽"
            sandbox="allow-scripts"
            srcdoc={preview.doc}
            style={{ height: `${exercise.previewHeight ?? 220}px` }}
          />
          {previewStuck && (
            <div class="vl-ex-notice" role="status">
              <p>預覽沒有回應，程式可能卡住了。改好程式碼後預覽會重新載入；如果沒有恢復，請重新整理頁面。</p>
              <button type="button" class="vl-ex-button vl-ex-quiet" data-action="reload" onClick={() => location.reload()}>
                重新整理頁面
              </button>
            </div>
          )}
          {pageErrors.length > 0 && (
            <ul class="vl-ex-errors" aria-live="polite">
              {pageErrors.map((message) => (
                <li>程式出錯了：{message}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div class="vl-ex-actions">
        <button type="button" class="vl-ex-button vl-ex-primary" data-action="check" disabled={checking} onClick={onCheck}>
          {checking ? '檢查中…' : '檢查'}
        </button>
        <button type="button" class="vl-ex-button" data-action="hint" disabled={flow.hintsShown >= 3} onClick={onHint}>
          {flow.hintsShown >= 3 ? '提示都看完了' : '給我提示'}
        </button>
        {canReveal(flow) && !solutionOpen && (
          <button type="button" class="vl-ex-button" data-action="reveal" onClick={onReveal}>
            看答案
          </button>
        )}
        <button type="button" class="vl-ex-button vl-ex-quiet" data-action="reset" onClick={onReset}>
          重設程式碼
        </button>
      </div>

      {feedback && (
        <p ref={feedbackRef} class="vl-ex-feedback" data-kind={feedback.kind} role="status">
          {feedback.kind === 'pass' ? '✓ ' : ''}
          {feedback.text}
          {feedback.kind === 'fail' && feedback.remaining && feedback.remaining > 1 ? `（還有 ${feedback.remaining - 1} 項沒通過）` : ''}
        </p>
      )}

      {flow.hintsShown > 0 && (
        <ol ref={hintsRef} class="vl-ex-hints">
          {exercise.hints.slice(0, flow.hintsShown).map((hint, index) => (
            <li>
              <strong>{HINT_LABELS[index]}：</strong>
              {hint}
            </li>
          ))}
        </ol>
      )}

      {solutionOpen && (
        <div ref={solutionRef} class="vl-ex-solution" data-no-context>
          <p class="vl-ex-label">標準答案（唯讀）</p>
          {editable.map((name) => (
            <div>
              <p class="vl-ex-label">{name}</p>
              <pre class="vl-ex-pre">{solution[name]}</pre>
            </div>
          ))}
          <button type="button" class="vl-ex-button" data-action="apply" onClick={applySolution}>
            套用答案
          </button>
        </div>
      )}
    </section>
  );
}
