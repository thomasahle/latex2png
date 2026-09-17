import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { persisted, readStoredValue } from '../src/lib/stores/persisted.js';
import { createContentStore } from '../src/lib/stores/content.js';
import { exportFormats, effectiveBackground, resolveExportBackground } from '../src/lib/utils/export-formats.js';

function fixture(initial = {}) {
  const data = new Map(Object.entries(initial));
  const events = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  return { data, events, document, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } };
}

test('malformed or invalid storage falls back without preventing in-memory changes', () => {
  const f = fixture({ setting: '{broken', wrong: '"not a number"' });
  assert.equal(readStoredValue('setting', 1, f), 1);
  assert.equal(readStoredValue('wrong', 1, { ...f, validate: Number.isFinite }), 1);
  const storage = { getItem() { throw Error('denied'); }, setItem() { throw Error('full'); } };
  const store = persisted('test', false, { storage });
  store.set(true);
  assert.equal(get(store), true);
  store.destroy();
});

test('pagehide and backgrounding flush the most recent debounced edit', () => {
  const f = fixture();
  const store = persisted('test', '', { ...f, debounce: 60_000 });
  store.set('first');
  store.update(value => value + ' last');
  assert.equal(f.data.size, 0);
  f.events.dispatchEvent(new Event('pagehide'));
  assert.equal(f.data.get('test'), '"first last"');
  store.set('hidden');
  f.document.visibilityState = 'hidden';
  f.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.data.get('test'), '"hidden"');
  store.set('destroyed');
  store.destroy();
  assert.equal(f.data.get('test'), '"destroyed"');
});

test('content loads immediately and saves edits made during startup', async () => {
  const f = fixture({ latexContent: 'saved' });
  const store = createContentStore(f);
  assert.equal(get(store), 'saved');
  await store.initialize(new URL('https://example.test/'));
  store.set('early edit');
  f.events.dispatchEvent(new Event('pagehide'));
  assert.equal(f.data.get('latexContent'), 'early edit');
  store.destroy();
});

test('shared URL wins over saved content, including an explicitly empty equation', async () => {
  const store = createContentStore(fixture({ latexContent: 'saved' }));
  await store.initialize(new URL('https://example.test/?latex=x%5E2'));
  assert.equal(get(store), 'x^2');
  await store.initialize(new URL('https://example.test/?latex='));
  assert.equal(get(store), '');
  store.destroy();
});

test('delayed decompression never overwrites a newer edit; invalid links retain saved content', async () => {
  const store = createContentStore(fixture({ latexContent: 'saved' }));
  await store.initialize(new URL('https://example.test/?z=bad'), async () => null);
  assert.equal(get(store), 'saved');
  await store.initialize(new URL('https://example.test/?z=ok'), async () => 'decoded');
  assert.equal(get(store), 'decoded');
  let finish;
  const initializing = store.initialize(new URL('https://example.test/?z=slow'), () => new Promise(resolve => { finish = resolve; }));
  store.update(() => 'newer edit');
  finish('stale link');
  await initializing;
  assert.equal(get(store), 'newer edit');
  store.destroy();
});

test('every export uses the same capability and background rules', () => {
  for (const [format, capabilities] of Object.entries(exportFormats)) {
    const settings = { format, background: 'transparent', customColor: '#ff0000' };
    assert.equal(effectiveBackground(settings), capabilities.transparent ? 'transparent' : 'solid');
    assert.equal(resolveExportBackground(settings, format, '#ffffff'), capabilities.transparent ? null : '#ffffff');
    assert.equal(resolveExportBackground({ ...settings, background: 'custom' }, format, '#ffffff'), '#ff0000');
  }
});
