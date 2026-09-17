import { createWorkerClient } from './worker-client.js';
import { trackError } from '../utils/analytics.js';

const client = createWorkerClient({
  createWorker: () => new Worker(new URL('../workers/mathjax-worker.js', import.meta.url), { type: 'module' }),
  onError: error => trackError(error, { context: 'mathjax_worker' }),
});

export const initWorker = () => client.init();
export const terminateWorker = () => client.terminate();

// Requests with the same key reject the older promise with AbortError.
// Independent consumers (including history thumbnails) opt out with key: null.
export function renderLatexToSvg(latex, display = true, { key = display ? 'display' : 'inline' } = {}) {
  return client.request({ type: 'render', latex, display }, key);
}

export function renderLatexToMathML(latex, display = true) {
  return client.request({ type: 'mathml', latex, display });
}

// Preview rendering handles obsolete responses itself; exports await its result.
export function renderLatexForPreview(latex) {
  return client.request({ type: 'preview', latex, display: true });
}

if (import.meta.hot) import.meta.hot.dispose(terminateWorker);
