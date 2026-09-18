import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import lzString from 'lz-string';
import { persisted, readStoredValue } from '../src/lib/stores/persisted.js';
import { createContentStore } from '../src/lib/stores/content.js';
import { createHistoryStore } from '../src/lib/stores/history.js';
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

test('shared history merges saves before storage events arrive and removes the intended entry', () => {
  const f = fixture();
  const first = createHistoryStore(f);
  const second = createHistoryStore(f);
  try {
    first.add('x^2');
    const entryToRemove = get(first)[0];
    second.add('y^2');
    assert.deepEqual(get(second).map(entry => entry.latex), ['y^2', 'x^2']);
    first.remove(entryToRemove);
    assert.deepEqual(get(first).map(entry => entry.latex), ['y^2']);
    f.events.dispatchEvent(Object.assign(new Event('storage'), { key: 'equationHistory', storageArea: f.storage }));
    assert.deepEqual(get(second).map(entry => entry.latex), ['y^2']);
    f.data.delete('equationHistory');
    f.events.dispatchEvent(Object.assign(new Event('storage'), { key: null, storageArea: f.storage }));
    assert.deepEqual(get(first), []);
    assert.deepEqual(get(second), []);
  } finally {
    first.destroy();
    second.destroy();
  }
});

test('failed writes keep new history in memory until storage is available again', () => {
  const f = fixture({ equationHistory: JSON.stringify([{ latex: 'saved', timestamp: 1 }]) });
  const write = f.storage.setItem;
  f.storage.setItem = () => { throw Error('full'); };
  const store = createHistoryStore(f);
  try {
    store.add('first');
    store.add('second');
    f.events.dispatchEvent(Object.assign(new Event('storage'), { key: 'equationHistory', storageArea: f.storage }));
    assert.deepEqual(get(store).map(entry => entry.latex), ['second', 'first', 'saved']);
    f.storage.setItem = write;
    store.add('third');
    assert.deepEqual(JSON.parse(f.data.get('equationHistory')).map(entry => entry.latex), ['third', 'second', 'first', 'saved']);
  } finally { store.destroy(); }
});

test('cross-tab synchronization is opt-in, ignores other storage areas, and cleans up', () => {
  const f = fixture({ shared: '1', local: '2' });
  const shared = persisted('shared', 0, { ...f, syncTabs: true });
  const local = persisted('local', 0, f);
  f.data.set('shared', '3');
  f.data.set('local', '4');
  f.events.dispatchEvent(Object.assign(new Event('storage'), { key: null, storageArea: {} }));
  assert.equal(get(shared), 1);
  f.events.dispatchEvent(Object.assign(new Event('storage'), { key: null, storageArea: f.storage }));
  assert.equal(get(shared), 3);
  assert.equal(get(local), 2);
  shared.destroy();
  local.destroy();
  f.data.set('shared', '5');
  f.events.dispatchEvent(Object.assign(new Event('storage'), { key: 'shared', storageArea: f.storage }));
  assert.equal(get(shared), 3);
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

test('real compressed links round-trip Unicode, plus signs, and intentional empty content', async () => {
  const equations = ['', 'x^2', String.raw`\frac{1+2}{3} + \text{café, 雪 & 100\%}`, 'a &= b \\\\\n c &= d', 'a'.repeat(5000)];
  // Keep a known existing link as well as generated examples.
  const examples = [['B4PQTEA', 'x^2'], ...equations.map(latex => [lzString.compressToEncodedURIComponent(latex), latex])];
  let withPlus;
  for (let n = 0; n < 1000 && !withPlus; n++) {
    const latex = `x_{${n}}`;
    const encoded = lzString.compressToEncodedURIComponent(latex);
    if (encoded.includes('+')) withPlus = [encoded, latex];
  }
  assert.ok(withPlus, 'exercise a literal plus parsed as a space');
  examples.push(withPlus);
  for (const [encoded, latex] of examples) {
    const f = fixture({ latexContent: 'saved' });
    const store = createContentStore(f);
    try {
      assert.equal(await store.initialize(new URL(`https://example.test/?z=${encoded}&v=1`)), 'loaded');
      assert.equal(get(store), latex);
      store.flush();
      assert.equal(f.data.get('latexContent'), latex);
    } finally { store.destroy(); }
  }
});

test('malformed compressed links cannot replace or clear the saved draft', async () => {
  const valid = lzString.compressToEncodedURIComponent(String.raw`\frac{x+1}{2}`);
  for (const value of ['', 'abc', '123', 'null', '?', 'garbage', valid.slice(0, -2), valid + 'extra']) {
    const f = fixture({ latexContent: 'saved' });
    const store = createContentStore(f);
    try {
      assert.equal(await store.initialize(new URL(`https://example.test/?z=${encodeURIComponent(value)}&v=1`)), 'invalid', value);
      assert.equal(get(store), 'saved', value);
      f.events.dispatchEvent(new Event('pagehide'));
      assert.equal(f.data.get('latexContent'), 'saved', value);
    } finally { store.destroy(); }
  }
});

test('equation query parameters take precedence while unrelated queries permit fragment links', async () => {
  const encoded = lzString.compressToEncodedURIComponent('compressed');
  const examples = [
    ['?utm_source=example#latex=x%2By', 'x+y', 'loaded'],
    [`?utm_source=example#z=${encoded}&v=1`, 'compressed', 'loaded'],
    [`?latex=query#z=${encoded}`, 'query', 'loaded'],
    ['?latex=#latex=fragment', '', 'loaded'],
    [`?z=${encoded}#latex=fragment`, 'compressed', 'loaded'],
    ['?z=abc#latex=fragment', 'saved', 'invalid'],
    ['?utm_source=example#editor', 'saved', 'none'],
  ];
  for (const [suffix, value, status] of examples) {
    const store = createContentStore(fixture({ latexContent: 'saved' }));
    try {
      assert.equal(await store.initialize(new URL(`https://example.test/${suffix}`)), status);
      assert.equal(get(store), value);
    } finally { store.destroy(); }
  }
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
  assert.equal(await initializing, 'superseded');
  assert.equal(get(store), 'newer edit');
  assert.equal(await store.initialize(new URL('https://example.test/?z=offline'), async () => { throw Error('Network unavailable'); }), 'invalid');
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
