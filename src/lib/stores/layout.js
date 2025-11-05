import { writable } from 'svelte/store';

function createLayoutStore() {
  const savedLayout = (() => {
    return localStorage.getItem('layout') || 'stacked';
  })();

  const { subscribe, set, update } = writable(savedLayout);

  return {
    subscribe,
    set: (value) => {
      set(value);
      localStorage.setItem('layout', value);
    },
    toggle: () => {
      update(value => {
        const next = value === 'side-by-side' ? 'stacked' : 'side-by-side';
        localStorage.setItem('layout', next);
        return next;
      });
    }
  };
}

export const layout = createLayoutStore();
