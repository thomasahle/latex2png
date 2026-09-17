import { persisted } from './persisted.js';
import { exportFormats as formats } from '../utils/export-formats.js';
export const exportFormats = Object.keys(formats);

function normalize(value) {
  return {
    format: exportFormats.includes(value?.format) ? value.format : 'PNG',
    background: ['solid', 'custom'].includes(value?.background) ? value.background : 'transparent',
    customColor: /^#[\da-f]{6}$/i.test(value?.customColor) ? value.customColor : '#808080',
  };
}
const store = persisted('exportSettings', normalize(), { parse: raw => normalize(JSON.parse(raw)) });
export const exportSettings = {
  subscribe: store.subscribe,
  set: value => store.set(normalize(value)),
  update: callback => store.update(value => normalize(callback(value))),
};
