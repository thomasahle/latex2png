import { writable } from 'svelte/store';

export const previewState = writable({ status: 'pending', error: '' });
let flushPreview;

export function registerPreview(flush) {
  flushPreview = flush;
  return () => { if (flushPreview === flush) flushPreview = undefined; };
}

export async function ensureCurrentPreview() {
  if (!flushPreview) throw new Error('The equation preview is not ready yet.');
  const result = await flushPreview();
  if (!result.latex.trim()) throw new Error('Enter a LaTeX equation before exporting.');
  return result;
}
