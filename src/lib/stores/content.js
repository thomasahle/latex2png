import { writable } from 'svelte/store';

function createContentStore() {
  const { subscribe, set, update } = writable('');
  let initialized = false;

  // Initialize content from URL or localStorage with delay to avoid race condition
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const latexParam = urlParams.get('latex');

      console.log('[content.js] URL param raw:', latexParam);
      console.log('[content.js] URL param chars:', latexParam ? [...latexParam].map(c => c.charCodeAt(0)) : null);
      console.log('[content.js] localStorage:', localStorage.getItem('latexContent'));

      if (latexParam) {
        console.log('[content.js] Setting from URL:', latexParam);
        set(latexParam);
      } else {
        const savedContent = localStorage.getItem('latexContent');
        if (savedContent) {
          console.log('[content.js] Setting from localStorage:', savedContent);
          set(savedContent);
        }
      }

      // Enable localStorage saving after initialization
      setTimeout(() => {
        initialized = true;
        console.log('[content.js] Initialized, localStorage saving enabled');
      }, 500);
    }, 100);
  }

  // Debounce localStorage writes to avoid blocking during rapid typing
  let saveTimeout;

  return {
    subscribe,
    set: (value) => {
      set(value);
      // Only save to localStorage after initialization, debounced
      if (initialized) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          localStorage.setItem('latexContent', value);
        }, 1000);
      }
    },
    update
  };
}

export const latexContent = createContentStore();
