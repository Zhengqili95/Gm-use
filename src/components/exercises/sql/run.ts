import wasmAssetUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createClient } from './client.mjs';
import type { SqlClient } from './types';
export type { Cell, SqlExercise, SqlResultSet, SqlRunResult, SqlCheckResult, SqlTable } from './types';

const client: SqlClient = createClient(() => {
  // Vite emits the WASM asset and handles the base prefix. Resolving against
  // BASE_URL also supports relative asset URLs without adding the prefix twice.
  const base = new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), location.origin);
  const wasmUrl = new URL(wasmAssetUrl, base).href;
  const worker = new Worker(new URL('./worker.browser.mjs', import.meta.url), { type: 'module' });
  return {
    postMessage: (request: unknown) => worker.postMessage({ request, wasmUrl }),
    onMessage: (callback: (result: unknown) => void) =>
      worker.addEventListener('message', event => callback(event.data)),
    onError: (callback: (error: { message: string }) => void) => {
      worker.addEventListener('error', callback, { once: true });
      worker.addEventListener('messageerror', () => callback({ message: 'SQL Worker 回應無法讀取。' }), { once: true });
    },
    terminate: () => worker.terminate(),
  };
});
export const { runSql, checkSqlExercise, describeTables } = client;
