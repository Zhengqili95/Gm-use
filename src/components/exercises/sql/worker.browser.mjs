import { executeRequest } from './engine.mjs';

self.onmessage = async ({ data: { request, wasmUrl } }) => {
  const result = await executeRequest(request, {
    locateFile: () => wasmUrl,
    onReady: () => self.postMessage({ type: 'ready' }),
  });
  self.postMessage({ type: 'result', result });
};
