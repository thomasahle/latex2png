import { persisted } from './persisted.js';

const store = persisted('vimMode', false, { validate: value => typeof value === 'boolean' });
export const vimMode = { ...store, toggle: () => store.update(value => !value) };
