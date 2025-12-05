// MathJax 4 service - uses Web Worker for off-main-thread rendering
// This improves INP (Interaction to Next Paint) by not blocking the main thread

import { trackError } from '../utils/analytics.js';

let worker = null;
let messageId = 0;
const pending = new Map();
let readyPromise = null;
let readyResolve = null;

export function initWorker() {
  if (typeof window === 'undefined') return;
  if (worker) return;

  // Create promise that resolves when worker signals ready
  readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  worker = new Worker(
    new URL('../workers/mathjax-worker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (e) => {
    const { type, id, success, svg, error } = e.data;

    // Handle ready signal
    if (type === 'ready') {
      readyResolve();
      return;
    }

    // Handle initialization error from within the worker
    if (type === 'init_error') {
      console.error('MathJax worker init error:', error);
      const err = new Error(error?.message || 'MathJax worker initialization failed');
      err.name = 'WorkerInitError';
      trackError(err, {
        context: 'mathjax_worker_init',
        source: error?.source,
        lineno: error?.lineno,
        colno: error?.colno,
        worker_stack: error?.stack
      });
      return;
    }

    // Handle render response
    const resolver = pending.get(id);
    if (resolver) {
      pending.delete(id);
      if (success) {
        resolver.resolve(svg);
      } else {
        resolver.reject(new Error(error));
      }
    }
  };

  worker.onerror = (event) => {
    console.error('MathJax worker error:', event);
    const error = new Error(event.message || 'MathJax worker error');
    error.filename = event.filename;
    error.lineno = event.lineno;
    error.colno = event.colno;
    trackError(error, {
      context: 'mathjax_worker',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  };
}

export async function renderLatexToSvg(latex, display = true) {
  // Ensure worker is initialized
  if (!worker) {
    initWorker();
  }

  // Wait for worker to be ready
  await readyPromise;

  const id = ++messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, latex, display });
  });
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    pending.clear();
    readyPromise = null;
    readyResolve = null;
  }
}
