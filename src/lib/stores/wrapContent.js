import { persisted } from './persisted.js';

const store = persisted('wrapContent', true, { validate: value => typeof value === 'boolean' });
export const wrapContent = { ...store, toggle: () => store.update(value => !value) };
