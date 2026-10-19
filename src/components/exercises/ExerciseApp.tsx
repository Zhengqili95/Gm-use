import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { registerExercise, touchExercise } from '../../lib/learn-context';
import { getExercise, updateExercise } from '../../lib/progress-store';
import { canReveal, initialFlow, isDone, reduce } from './flow';
import { buildSrcdoc } from './runner/build-srcdoc';
import iframeRunner from './runner/iframe-runner.js?raw';
import { runChecks } from './runner/run-checks';
import type { Files, PageExercise } from './types';

const HINT_LABELS = ['觀念提醒', '檢查位置', '語法範例'] as const;

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
  const [previewDoc, setPreviewDoc] = useState(() => buildSrcdoc(startFiles, iframeRunner));
  const [solutionOpen, setSolutionOpen] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

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

  // 預覽：停止輸入 500 毫秒後才更新，避免每打一個字都重新載入
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageErrors([]);
      setPreviewDoc(buildSrcdoc(files, iframeRunner));
    }, 500);
    return () => clearTimeout(timer);
  }, [files]);

  // 預覽頁裡的程式出錯時，執行器會傳訊息過來，顯示在預覽下面
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== previewRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.source === 'vibe' && data.type === 'error') {
        setPageErrors((previous) => [...previous.slice(-2), String(data.message)]);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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
      setFeedback({ kind: 'timeout', text: '程式執行太久，已經停止；檢查一下有沒有寫成一直重複的迴圈。' });
    } else if (failed.length === 0) {
      setFeedback({ kind: 'pass', text: exercise.success });
    } else {
      setFeedback({ kind: 'fail', text: failed[0]!.hint, remaining: failed.length });
    }
  }

  function onHint() {
    touch();
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
    <section class="vl-ex" data-exercise-id={exercise.id} data-status={flow.status} data-no-context>
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
            ref={previewRef}
            class="vl-ex-preview"
            title="預覽"
            sandbox="allow-scripts"
            srcdoc={previewDoc}
            style={{ height: `${exercise.previewHeight ?? 220}px` }}
          />
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
        <p class="vl-ex-feedback" data-kind={feedback.kind} role="status">
          {feedback.kind === 'pass' ? '✓ ' : ''}
          {feedback.text}
          {feedback.kind === 'fail' && feedback.remaining && feedback.remaining > 1 ? `（還有 ${feedback.remaining - 1} 項沒通過）` : ''}
        </p>
      )}

      {flow.hintsShown > 0 && (
        <ol class="vl-ex-hints">
          {exercise.hints.slice(0, flow.hintsShown).map((hint, index) => (
            <li>
              <strong>{HINT_LABELS[index]}：</strong>
              {hint}
            </li>
          ))}
        </ol>
      )}

      {solutionOpen && (
        <div class="vl-ex-solution" data-no-context>
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
