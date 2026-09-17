import { persisted } from './persisted.js';

const store = persisted('zoomLevel', 1.5, {
  validate: value => Number.isFinite(value) && value >= 1 && value <= 5,
  debounce: 500,
});
export const zoom = { ...store, set: value => store.set(Number(value)) };
if (import.meta.hot) import.meta.hot.dispose(() => store.destroy());
