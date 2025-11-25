import { writable } from 'svelte/store';

function createZoomStore() {
  const savedZoom = localStorage.getItem('zoomLevel');
  const parsed = savedZoom ? parseFloat(savedZoom) : NaN;
  const initialZoom = !isNaN(parsed) && parsed > 0 ? parsed : 1.5;
  
  const { subscribe, set } = writable(initialZoom);
  
  return {
    subscribe,
    set: (value) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue) || numValue <= 0) return; // Ignore invalid values
      set(numValue);
      localStorage.setItem('zoomLevel', numValue);
    }
  };
}

export const zoom = createZoomStore();
