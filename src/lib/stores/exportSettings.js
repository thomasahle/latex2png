import { get, writable } from 'svelte/store';

export const exportFormats = ['PNG', 'JPEG', 'SVG', 'PDF'];

let saved = {};
try { saved = JSON.parse(localStorage.getItem('exportSettings') || '{}'); } catch {}

export const exportSettings = writable({
  format: exportFormats.includes(saved?.format) ? saved.format : 'PNG',
  background: ['solid', 'custom'].includes(saved?.background) ? saved.background : 'transparent',
  customColor: /^#[\da-f]{6}$/i.test(saved?.customColor) ? saved.customColor : '#808080',
});

exportSettings.subscribe(value => {
  try { localStorage.setItem('exportSettings', JSON.stringify(value)); } catch {}
});

// JPEG and PDF have an opaque page; PNG and SVG can preserve transparency.
export function exportBackground(format = get(exportSettings).format) {
  const settings = get(exportSettings);
  if (settings.background === 'custom') return settings.customColor;
  if (!['JPEG', 'PDF'].includes(format) && settings.background === 'transparent') return null;
  const color = getComputedStyle(document.body).getPropertyValue('--background').trim();
  return color ? `hsl(${color})` : '#ffffff';
}
