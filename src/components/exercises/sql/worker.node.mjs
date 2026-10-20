import { parentPort } from 'node:worker_threads';
import { executeRequest } from './engine.mjs';

parentPort.once('message', async request => {
  const result = await executeRequest(request, { onReady: () => parentPort.postMessage({ type: 'ready' }) });
  parentPort.postMessage({ type: 'result', result });
});
