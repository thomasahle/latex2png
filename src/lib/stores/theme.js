import { persisted } from './persisted.js';

const prefersDark = globalThis.window?.matchMedia?.('(prefers-color-scheme: dark)').matches;
const store = persisted('theme', prefersDark ? 'dark' : 'light', {
  parse: value => value, serialize: value => value,
  validate: value => value === 'light' || value === 'dark',
});
const unsubscribe = store.subscribe(value => globalThis.document?.body.setAttribute('data-theme', value));
export const theme = { ...store, toggle: () => store.update(value => value === 'dark' ? 'light' : 'dark') };
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
