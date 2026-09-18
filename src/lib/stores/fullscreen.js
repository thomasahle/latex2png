import { derived, get, readable } from 'svelte/store';
import { persisted } from './persisted.js';

const preference = persisted('fullscreen', false, { validate: value => typeof value === 'boolean' });

// Keep phones fullscreen after rotation too, without forcing short desktop windows.
export const fullscreenRequired = readable(false, set => {
  const query = globalThis.window?.matchMedia('(max-width: 639px), (pointer: coarse) and (max-height: 639px)');
  if (!query) return;
  const update = () => set(query.matches);
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
});

let previousScroll = 0;
let wasFullscreen = false;
const effective = derived([preference, fullscreenRequired], ([preferred, required]) => {
  const enabled = preferred || required;
  // Capture before Svelte reduces the page height and clamps scrollY.
  if (enabled && !wasFullscreen) previousScroll = globalThis.window?.scrollY ?? 0;
  wasFullscreen = enabled;
  return enabled;
});

function set(value) {
  if (typeof value !== 'boolean' || get(fullscreenRequired)) return;
  preference.set(value);
}
export const fullscreen = {
  subscribe: effective.subscribe, set,
  toggle: () => set(!get(effective)),
  getPreviousScroll: () => previousScroll,
};
