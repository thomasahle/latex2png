import { writable } from 'svelte/store';

function createZoomStore() {
  const savedZoom = localStorage.getItem('zoomLevel');
  const parsed = savedZoom ? parseFloat(savedZoom) : NaN;
  const initialZoom = !isNaN(parsed) && parsed > 0 ? parsed : 1.5;

  const { subscribe, set } = writable(initialZoom);

  // Debounce localStorage writes to avoid blocking during rapid zoom changes
  let saveTimeout;

  return {
    subscribe,
    set: (value) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue) || numValue <= 0) return; // Ignore invalid values
      set(numValue);
      // Debounce localStorage write
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        localStorage.setItem('zoomLevel', numValue);
      }, 500);
    }
  };
}

export const zoom = createZoomStore();
