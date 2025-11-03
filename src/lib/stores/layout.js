import { writable } from 'svelte/store';

function createLayoutStore() {
  const savedLayout = (() => {
    try {
      return localStorage.getItem('layout') || 'stacked';
    } catch {
      return 'stacked';
    }
  })();
  
  const { subscribe, set, update } = writable(savedLayout);
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      try {
        localStorage.setItem('layout', value);
      } catch {}
    },
    toggle: () => {
      update(value => {
        const next = value === 'side-by-side' ? 'stacked' : 'side-by-side';
        try {
          localStorage.setItem('layout', next);
        } catch {}
        return next;
      });
    }
  };
}

export const layout = createLayoutStore();
