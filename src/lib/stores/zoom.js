import { writable } from 'svelte/store';

function createZoomStore() {
  const savedZoom = localStorage.getItem('zoomLevel');
  const initialZoom = savedZoom ? parseFloat(savedZoom) : 1.5;
  
  const { subscribe, set } = writable(initialZoom);
  
  return {
    subscribe,
    set: (value) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      set(numValue);
      localStorage.setItem('zoomLevel', numValue);
    }
  };
}

export const zoom = createZoomStore();
