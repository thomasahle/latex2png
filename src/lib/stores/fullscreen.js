import { get } from 'svelte/store';
import { persisted } from './persisted.js';

const store = persisted('fullscreen', false, { validate: value => typeof value === 'boolean' });
let previousScroll = 0;
function set(value) {
  if (typeof value !== 'boolean') return;
  // Capture before Svelte reduces the page height and clamps scrollY.
  if (value && !get(store)) previousScroll = window.scrollY;
  store.set(value);
}
export const fullscreen = {
  subscribe: store.subscribe, set,
  toggle: () => set(!get(store)),
  getPreviousScroll: () => previousScroll,
};
