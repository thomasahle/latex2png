import { writable } from 'svelte/store';

function createContentStore() {
  const { subscribe, set, update } = writable('');
  let initialized = false;
  
  // Initialize content from URL or localStorage with delay to avoid race condition
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const latexParam = urlParams.get('latex');
      
      if (latexParam) {
        set(latexParam);
      } else {
        const savedContent = localStorage.getItem('latexContent');
        if (savedContent) {
          set(savedContent);
        }
      }
      
      // Enable localStorage saving after initialization
      setTimeout(() => {
        initialized = true;
      }, 500);
    }, 100);
  }
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      // Only save to localStorage after initialization
      if (initialized) {
        localStorage.setItem('latexContent', value);
      }
    },
    update
  };
}

export const latexContent = createContentStore();
