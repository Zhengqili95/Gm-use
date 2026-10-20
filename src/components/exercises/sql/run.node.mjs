import { Worker } from 'node:worker_threads';
import { createClient } from './client.mjs';

/** @type {import('./types').SqlClient} */
const client = createClient(() => {
  const worker = new Worker(new URL('./worker.node.mjs', import.meta.url));
  return {
    postMessage: request => worker.postMessage(request),
    onMessage: callback => worker.on('message', callback),
    onError: callback => worker.once('error', callback),
    onExit: callback => worker.once('exit', callback),
    terminate: () => worker.terminate(),
  };
});
export const { runSql, checkSqlExercise, describeTables } = client;
