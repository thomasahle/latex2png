import { writable } from 'svelte/store';

function createVimModeStore() {
  const savedVimMode = (() => {
    try {
      return localStorage.getItem('vimMode') === 'true';
    } catch {
      return false;
    }
  })();
  
  const { subscribe, set, update } = writable(savedVimMode);
  
  return {
    subscribe,
    toggle: () => {
      update(current => {
        const next = !current;
        try {
          localStorage.setItem('vimMode', String(next));
        } catch {}
        return next;
      });
    },
    set: (value) => {
      set(value);
      try {
        localStorage.setItem('vimMode', String(value));
      } catch {}
    }
  };
}

export const vimMode = createVimModeStore();
