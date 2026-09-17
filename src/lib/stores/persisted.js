import { writable } from 'svelte/store';

function browserStorage() {
  if (typeof window === 'undefined') return undefined;
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function readStoredValue(key, fallback, {
  parse = JSON.parse, validate = () => true, storage = browserStorage(),
} = {}) {
  try {
    const raw = storage?.getItem(key);
    if (raw == null) return fallback;
    const value = parse(raw);
    return validate(value) ? value : fallback;
  } catch { return fallback; }
}

export function writeStoredValue(key, value, {
  serialize = JSON.stringify, storage = browserStorage(),
} = {}) {
  try { storage?.setItem(key, serialize(value)); } catch {
    // A full or unavailable storage must not prevent editing in this visit.
  }
}

export function persisted(key, fallback, {
  parse = JSON.parse, serialize = JSON.stringify, validate = () => true,
  debounce = 0, storage = browserStorage(), events = globalThis.window,
  document = globalThis.document,
} = {}) {
  let current = readStoredValue(key, fallback, { parse, validate, storage });
  const store = writable(current);
  let timer;
  let dirty = false;
  function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    writeStoredValue(key, current, { serialize, storage });
    dirty = false;
  }
  function set(value) {
    if (!validate(value)) return;
    current = value;
    dirty = true;
    store.set(value);
    clearTimeout(timer);
    if (debounce) timer = setTimeout(flush, debounce);
    else flush();
  }
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flush();
  }
  // Immediate stores have nothing queued when the page closes.
  if (debounce) {
    events?.addEventListener('pagehide', flush);
    document?.addEventListener('visibilitychange', onVisibilityChange);
  }
  return {
    subscribe: store.subscribe,
    set,
    update: callback => set(callback(current)),
    flush,
    destroy() {
      flush();
      events?.removeEventListener('pagehide', flush);
      document?.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
