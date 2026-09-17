import { persisted } from './persisted.js';

const MAX_HISTORY_ENTRIES = 25;
const store = persisted('equationHistory', [], {
  parse: raw => {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(entry => typeof entry?.latex === 'string'
      && Number.isFinite(entry?.timestamp)).slice(0, MAX_HISTORY_ENTRIES) : [];
  },
});
export const history = {
  subscribe: store.subscribe,
  add(latex) {
    if (!latex?.trim()) return;
    store.update(entries => entries[0]?.latex === latex ? entries
      : [{ latex, timestamp: Date.now() }, ...entries].slice(0, MAX_HISTORY_ENTRIES));
  },
  remove: index => store.update(entries => entries.filter((_, i) => i !== index)),
  clear: () => store.set([]),
};
