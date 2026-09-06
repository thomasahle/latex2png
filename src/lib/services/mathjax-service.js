// MathJax 4 service - uses Web Worker for off-main-thread rendering
// This improves INP (Interaction to Next Paint) by not blocking the main thread

import { trackError } from '../utils/analytics.js';

// How long to wait for the worker's 'ready' signal before giving up
const READY_TIMEOUT_MS = 20000;

let worker = null;
let messageId = 0;
const pending = new Map();
let readyPromise = null;
let readyResolve = null;
let readyReject = null;
let readyTimer = null;
let isReady = false;

// Fail worker startup (or a crashed worker): reject the ready promise so
// callers waiting on it get a clear error instead of hanging forever, and
// fail any requests already in flight for the same reason.
function failWorker(error) {
  clearTimeout(readyTimer);
  readyTimer = null;
  readyReject?.(error);
  for (const { reject } of pending.values()) {
    reject(error);
  }
  pending.clear();
}

export function initWorker() {
  if (typeof window === 'undefined') return;
  if (worker) return;

  // Create promise that resolves when worker signals ready (or rejects if it never does)
  isReady = false;
  readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  // The rejection is surfaced through renderLatexToSvg(); avoid an
  // "unhandled rejection" when nobody happens to be awaiting it yet.
  readyPromise.catch(() => {});

  readyTimer = setTimeout(() => {
    failWorker(new Error(
      `MathJax did not start within ${READY_TIMEOUT_MS / 1000} seconds. ` +
      'Check that scripts are not blocked and that your browser supports module web workers.'
    ));
  }, READY_TIMEOUT_MS);

  worker = new Worker(
    new URL('../workers/mathjax-worker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (e) => {
    const { type, id, success, svg, error } = e.data;

    // Handle ready signal
    if (type === 'ready') {
      isReady = true;
      clearTimeout(readyTimer);
      readyTimer = null;
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
      failWorker(err);
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

  // Note: a failed import inside a module worker never reaches the worker's
  // own self.onerror (the module body never runs); it only shows up here.
  worker.onerror = (event) => {
    console.error('MathJax worker error:', event);
    const detail = event.message || 'the worker script failed to load';
    const error = new Error(isReady
      ? `MathJax worker error: ${detail}`
      : `MathJax failed to start: ${detail}`);
    error.filename = event.filename;
    error.lineno = event.lineno;
    error.colno = event.colno;
    trackError(error, {
      context: 'mathjax_worker',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    failWorker(error);
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
    clearTimeout(readyTimer);
    readyTimer = null;
    pending.clear();
    readyPromise = null;
    readyResolve = null;
    readyReject = null;
    isReady = false;
  }
}
