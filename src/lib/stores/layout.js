import { derived, readable } from 'svelte/store';
import { persisted } from './persisted.js';

const preference = persisted('layout', 'stacked', {
  parse: value => value, serialize: value => value,
  validate: value => value === 'stacked' || value === 'side-by-side',
});
const mobile = readable(false, set => {
  const query = globalThis.window?.matchMedia('(max-width: 639px)');
  if (!query) return;
  const update = () => set(query.matches);
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
});
const effective = derived([preference, mobile], ([value, isMobile]) => isMobile ? 'stacked' : value);
export const layout = {
  subscribe: effective.subscribe,
  set: preference.set,
  toggle: () => preference.update(value => value === 'stacked' ? 'side-by-side' : 'stacked'),
};
