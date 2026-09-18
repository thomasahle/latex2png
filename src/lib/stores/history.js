import { persisted } from './persisted.js';

const MAX_HISTORY_ENTRIES = 25;

export const historyEntryKey = entry => JSON.stringify([entry.timestamp, entry.latex]);

export function createHistoryStore(options = {}) {
  const store = persisted('equationHistory', [], {
    syncTabs: true,
    parse: raw => {
      const value = JSON.parse(raw);
      const seen = new Set();
      return Array.isArray(value) ? value.filter(entry => {
        if (typeof entry?.latex !== 'string' || !Number.isFinite(entry?.timestamp)) return false;
        const key = historyEntryKey(entry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, MAX_HISTORY_ENTRIES) : [];
    },
    ...options,
  });
  return {
    subscribe: store.subscribe,
    add(latex) {
      if (!latex?.trim()) return;
      store.update(entries => entries[0]?.latex === latex ? entries
        : [{ latex, timestamp: Date.now() }, ...entries].slice(0, MAX_HISTORY_ENTRIES));
    },
    remove: entry => store.update(entries => entries.filter(saved => historyEntryKey(saved) !== historyEntryKey(entry))),
    clear: () => store.set([]),
    destroy: store.destroy,
  };
}

export const history = createHistoryStore();
if (import.meta.hot) import.meta.hot.dispose(() => history.destroy());
