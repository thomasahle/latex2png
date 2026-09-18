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
  if (!storage) return false;
  try {
    storage.setItem(key, serialize(value));
    return true;
  } catch {
    // A full or unavailable storage must not prevent editing in this visit.
    return false;
  }
}

export function persisted(key, fallback, {
  parse = JSON.parse, serialize = JSON.stringify, validate = () => true,
  debounce = 0, storage = browserStorage(), events = globalThis.window,
  document = globalThis.document, syncTabs = false,
} = {}) {
  let current = readStoredValue(key, fallback, { parse, validate, storage });
  const store = writable(current);
  let timer;
  let dirty = false;
  function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = !writeStoredValue(key, current, { serialize, storage });
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
  function refresh() {
    // Keep unsaved in-memory changes when storage is full or unavailable.
    if (dirty || !storage) return;
    try {
      const raw = storage.getItem(key);
      const value = raw == null ? fallback : parse(raw);
      if (!validate(value)) return;
      current = value;
      store.set(value);
    } catch { /* An inaccessible or malformed external value cannot erase this visit's state. */ }
  }
  function onStorage(event) {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key === key || event.key === null) refresh();
  }
  if (syncTabs) events?.addEventListener('storage', onStorage);
  // Immediate stores have nothing queued when the page closes.
  if (debounce) {
    events?.addEventListener('pagehide', flush);
    document?.addEventListener('visibilitychange', onVisibilityChange);
  }
  return {
    subscribe: store.subscribe,
    set,
    update(callback) {
      // Read before updating too: another tab's storage event may still be queued.
      if (syncTabs) refresh();
      set(callback(current));
    },
    flush,
    destroy() {
      flush();
      events?.removeEventListener('pagehide', flush);
      document?.removeEventListener('visibilitychange', onVisibilityChange);
      if (syncTabs) events?.removeEventListener('storage', onStorage);
    },
  };
}
