export const TIMEOUT_MS = 3000;
// Starting the Worker (module fetch, WASM download and compile) is not part of
// the 3 s run budget; it gets a longer limit of its own so a stalled download
// still ends instead of hanging forever.
export const LOAD_TIMEOUT_MS = 20000;

// Adapters supply a dedicated Worker per call. Termination is awaited in Node,
// so the promise resolving also means its runaway thread has been stopped.
// The Worker posts { type: 'ready' } once sql.js is loaded, then
// { type: 'result', result } when it is done.
export function createClient(createWorker, { loadTimeoutMs = LOAD_TIMEOUT_MS, runTimeoutMs = TIMEOUT_MS } = {}) {
  function call(request) {
    return new Promise(resolve => {
      let worker;
      let settled = false;
      let timer = setTimeout(
        () => finish({ status: 'error', error: 'SQL 引擎載入逾時，請檢查網路連線後重新整理頁面。' }),
        loadTimeoutMs,
      );
      async function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { await worker?.terminate(); } catch { /* Already exited. */ }
        if (request.action === 'check' && result.status !== 'ok') {
          result.checks = request.checks.map(check => ({ id: check.id, passed: false }));
        }
        resolve(result);
      }
      function onMessage(message) {
        if (settled) return;
        if (message?.type === 'ready') {
          clearTimeout(timer);
          timer = setTimeout(() => finish({ status: 'timeout' }), runTimeoutMs);
        } else if (message?.type === 'result') {
          finish(message.result ?? { status: 'error', error: 'SQL Worker 回應格式不正確。' });
        }
      }
      try {
        worker = createWorker();
        worker.onMessage(onMessage);
        worker.onError(error => finish({ status: 'error', error: error.message || 'SQL Worker 執行失敗。' }));
        worker.onExit?.(() => finish({ status: 'error', error: 'SQL Worker 提前結束。' }));
        worker.postMessage(request);
      } catch (error) {
        finish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    });
  }
  return {
    runSql: (setup, learnerSql) => call({ action: 'run', setup, learnerSql }),
    checkSqlExercise: (exercise, learnerSql) =>
      call({ action: 'check', setup: exercise.setup, learnerSql, checks: exercise.checks }),
    async describeTables(setup) {
      const result = await call({ action: 'describe', setup });
      if (result.status !== 'ok') {
        const error = new Error(result.status === 'timeout' ? 'SQL 執行逾時（3 秒）。' : result.error);
        error.name = result.status === 'timeout' ? 'SqlTimeoutError' : 'SqlExecutionError';
        throw error;
      }
      return result.tables;
    },
  };
}
