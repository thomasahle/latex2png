// MathJax 4 service - uses Web Worker for off-main-thread rendering
// This improves INP (Interaction to Next Paint) by not blocking the main thread

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

  worker.onerror = (error) => {
    console.error('MathJax worker error:', error);
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
