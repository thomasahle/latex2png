import { writable } from 'svelte/store';

function createContentStore() {
  const { subscribe, set, update } = writable('');
  let initialized = false;
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      // Only save to localStorage after initialization to avoid race conditions
      if (initialized) {
        localStorage.setItem('latexContent', value);
      }
    },
    update,
    // Called after the 100ms delay to mark as ready for localStorage saving
    markInitialized: () => {
      initialized = true;
    }
  };
}

export const latexContent = createContentStore();
