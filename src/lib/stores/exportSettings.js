import { get, writable } from 'svelte/store';
import { zoom } from './zoom.js';

export const exportFormats = ['PNG', 'JPEG', 'SVG', 'PDF'];
export const exportScales = [1, 1.5, 2, 3, 4, 5];

let saved = {};
try { saved = JSON.parse(localStorage.getItem('exportSettings') || '{}'); } catch {}

export const exportSettings = writable({
  format: exportFormats.includes(saved?.format) ? saved.format : 'PNG',
  background: saved?.background === 'solid' ? 'solid' : 'transparent',
  scale: exportScales.includes(saved?.scale) ? saved.scale : (exportScales.includes(get(zoom)) ? get(zoom) : 1.5),
});

exportSettings.subscribe(value => {
  try { localStorage.setItem('exportSettings', JSON.stringify(value)); } catch {}
});

// JPEG and PDF have an opaque page; PNG and SVG can preserve transparency.
export function exportBackground(format = get(exportSettings).format) {
  if (!['JPEG', 'PDF'].includes(format) && get(exportSettings).background === 'transparent') return null;
  const color = getComputedStyle(document.body).getPropertyValue('--background').trim();
  return color ? `hsl(${color})` : '#ffffff';
}
